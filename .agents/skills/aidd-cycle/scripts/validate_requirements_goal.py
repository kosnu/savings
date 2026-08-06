#!/usr/bin/env python3
"""Validate the AIDD Requirements Goal input/provenance manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


GENERIC_IMPLEMENTATION_TOPICS = {
    "documentation",
    "mock",
    "repository",
    "review",
    "test",
    "ui",
    "verification",
    "web",
}


class ValidationError(ValueError):
    pass


def normalize(value: str) -> str:
    return " ".join(value.split()).casefold()


def require_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"{label} must be a non-empty string")
    return value.strip()


def extract_manifest(document: str) -> dict[str, Any]:
    match = re.search(
        r"(?ms)^## Requirements Input Gate\s*$.*?```json\s*\n(.*?)\n```",
        document,
    )
    if match is None:
        raise ValidationError("Requirements Input Gate JSON block is missing")

    try:
        manifest = json.loads(match.group(1))
    except json.JSONDecodeError as error:
        raise ValidationError(f"Requirements Input Gate JSON is invalid: {error}") from error

    if not isinstance(manifest, dict):
        raise ValidationError("Requirements Input Gate must be a JSON object")

    allowed_keys = {"task_context", "direct_rules", "depends_on"}
    unknown_keys = set(manifest) - allowed_keys
    if unknown_keys:
        raise ValidationError(
            f"non-Issue input keys are not allowed: {', '.join(sorted(unknown_keys))}"
        )

    return manifest


def validate_task_context(task_context: Any, issue_body: bytes) -> None:
    if not isinstance(task_context, dict):
        raise ValidationError("task_context must be an object")

    required_keys = {"source", "issue", "url", "updated_at", "body_sha256"}
    if set(task_context) != required_keys:
        raise ValidationError("task_context must contain only source, issue, url, updated_at, body_sha256")

    if task_context["source"] != "issue_body":
        raise ValidationError("task_context.source must be issue_body")

    require_string(task_context["issue"], "task_context.issue")
    url = require_string(task_context["url"], "task_context.url")
    require_string(task_context["updated_at"], "task_context.updated_at")
    if not url.startswith("https://github.com/"):
        raise ValidationError("task_context.url must be a GitHub Issue URL")

    actual_hash = hashlib.sha256(issue_body).hexdigest()
    if task_context["body_sha256"] != actual_hash:
        raise ValidationError("task_context.body_sha256 does not match the supplied Issue body")


def validate_direct_rule(
    entry: Any,
    issue_body: str,
    rules_by_id: dict[str, dict[str, Any]],
) -> str:
    if not isinstance(entry, dict):
        raise ValidationError("each direct_rules entry must be an object")

    required_keys = {"id", "issue_evidence", "match", "reason"}
    optional_keys = {"explicit_surface"}
    if not required_keys.issubset(entry) or set(entry) - required_keys - optional_keys:
        raise ValidationError(
            "each direct rule must contain id, issue_evidence, match, reason and optional explicit_surface"
        )

    rule_id = require_string(entry["id"], "direct_rules.id")
    evidence = require_string(entry["issue_evidence"], f"{rule_id}.issue_evidence")
    require_string(entry["reason"], f"{rule_id}.reason")

    rule = rules_by_id.get(rule_id)
    if rule is None:
        raise ValidationError(f"unknown rule-map node: {rule_id}")

    if normalize(evidence) not in normalize(issue_body):
        raise ValidationError(f"{rule_id}.issue_evidence is not present in the Issue body")

    match = entry["match"]
    if not isinstance(match, dict) or set(match) != {"field", "value"}:
        raise ValidationError(f"{rule_id}.match must contain only field and value")

    field = require_string(match["field"], f"{rule_id}.match.field")
    value = require_string(match["value"], f"{rule_id}.match.value")
    if field not in {"paths", "domains", "activities", "topics"}:
        raise ValidationError(f"{rule_id}.match.field is invalid: {field}")

    applicable_values = rule.get("applies_to", {}).get(field, [])
    if value not in applicable_values:
        raise ValidationError(f"{rule_id} does not declare {field}={value}")

    implementation_paths = rule.get("applies_to", {}).get("paths", [])
    is_implementation_rule = any(path.startswith("apps/") for path in implementation_paths)
    if is_implementation_rule and not rule_id.startswith("domain."):
        explicit_surface = require_string(
            entry.get("explicit_surface"), f"{rule_id}.explicit_surface"
        )
        distinctive_topics = {
            topic.casefold()
            for topic in rule.get("applies_to", {}).get("topics", [])
            if topic.casefold() not in GENERIC_IMPLEMENTATION_TOPICS
        }
        if explicit_surface.casefold() not in distinctive_topics:
            raise ValidationError(
                f"{rule_id}.explicit_surface must be a distinctive declared topic"
            )
        if normalize(explicit_surface) not in normalize(evidence):
            raise ValidationError(
                f"{rule_id}.explicit_surface must be explicitly present in Issue evidence"
            )

    return rule_id


def validate_dependencies(
    entries: Any,
    direct_rule_ids: set[str],
    rules_by_id: dict[str, dict[str, Any]],
) -> None:
    if not isinstance(entries, list):
        raise ValidationError("depends_on must be an array")

    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {"id", "via"}:
            raise ValidationError("each depends_on entry must contain only id and via")
        rule_id = require_string(entry["id"], "depends_on.id")
        via = require_string(entry["via"], f"{rule_id}.via")
        if rule_id in seen or rule_id in direct_rule_ids:
            raise ValidationError(f"duplicate rule-map node: {rule_id}")
        if via not in rules_by_id or rule_id not in rules_by_id:
            raise ValidationError(f"unknown depends_on edge: {via} -> {rule_id}")
        if rule_id not in rules_by_id[via].get("depends_on", []):
            raise ValidationError(f"rule-map does not declare depends_on edge: {via} -> {rule_id}")
        seen.add(rule_id)


def validate(issue_body_path: Path, document_path: Path, rule_map_path: Path) -> None:
    issue_body_bytes = issue_body_path.read_bytes()
    issue_body = issue_body_bytes.decode("utf-8")
    document = document_path.read_text(encoding="utf-8")
    rule_map = json.loads(rule_map_path.read_text(encoding="utf-8"))
    rules_by_id = {rule["id"]: rule for rule in rule_map["rules"]}
    manifest = extract_manifest(document)

    validate_task_context(manifest.get("task_context"), issue_body_bytes)

    direct_rules = manifest.get("direct_rules")
    if not isinstance(direct_rules, list):
        raise ValidationError("direct_rules must be an array")
    direct_rule_ids = {
        validate_direct_rule(entry, issue_body, rules_by_id) for entry in direct_rules
    }
    if len(direct_rule_ids) != len(direct_rules):
        raise ValidationError("direct_rules contains duplicate ids")

    validate_dependencies(manifest.get("depends_on"), direct_rule_ids, rules_by_id)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--issue-body", required=True, type=Path)
    parser.add_argument("--document", required=True, type=Path)
    parser.add_argument("--rule-map", required=True, type=Path)
    args = parser.parse_args()

    try:
        validate(args.issue_body, args.document, args.rule_map)
    except (OSError, UnicodeDecodeError, KeyError, json.JSONDecodeError, ValidationError) as error:
        print(f"requirements input gate: failed: {error}", file=sys.stderr)
        return 1

    print("requirements input gate: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
