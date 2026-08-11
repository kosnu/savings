#!/usr/bin/env python3
"""Validate the AIDD Requirements Goal input/provenance manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from artifact_source import SourceError, load_source
from git_baseline import (
    GitBaselineError,
    canonical_source_path,
    require_canonical_worktree_path,
)


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
ISSUE_ID_PATTERN = re.compile(
    r"(?P<owner>[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))"
    r"/(?P<repo>[A-Za-z0-9_.-]+)#(?P<number>[1-9][0-9]*)"
)
RFC3339_UTC_PATTERN = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}T"
    r"[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z"
)


class ValidationError(ValueError):
    pass


def normalize(value: str) -> str:
    return " ".join(value.split()).casefold()


def require_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"{label} must be a non-empty string")
    return value.strip()


def require_canonical_input(
    repo_root: Path,
    supplied_path: Path,
    relative_path: Path,
    label: str,
) -> Path:
    try:
        return require_canonical_worktree_path(
            repo_root, supplied_path, relative_path, label
        )
    except GitBaselineError as error:
        raise ValidationError(str(error)) from error


def validate_rule_map(rule_map: Any) -> dict[str, dict[str, Any]]:
    rules = rule_map.get("rules") if isinstance(rule_map, dict) else None
    if not isinstance(rules, list):
        raise ValidationError("rule-map.rules must be an array")

    rules_by_id: dict[str, dict[str, Any]] = {}
    for rule in rules:
        if not isinstance(rule, dict):
            raise ValidationError("each rule-map rule must be an object")
        rule_id = require_string(rule.get("id"), "rule-map rule id")
        if rule_id in rules_by_id:
            raise ValidationError(f"duplicate rule-map node: {rule_id}")
        applies_to = rule.get("applies_to")
        if not isinstance(applies_to, dict):
            raise ValidationError(f"{rule_id}.applies_to must be an object")
        for field in ("paths", "domains", "activities", "topics"):
            values = applies_to.get(field, [])
            if not isinstance(values, list) or any(
                not isinstance(value, str) or not value.strip() for value in values
            ):
                raise ValidationError(
                    f"{rule_id}.applies_to.{field} must be an array of strings"
                )
        dependencies = rule.get("depends_on", [])
        if not isinstance(dependencies, list) or any(
            not isinstance(dependency, str) or not dependency.strip()
            for dependency in dependencies
        ):
            raise ValidationError(f"{rule_id}.depends_on must be an array of strings")
        rules_by_id[rule_id] = rule
    return rules_by_id


def extract_manifest(source: dict[str, Any]) -> dict[str, Any]:
    manifest = source["validation"].get("input_gate")
    if not isinstance(manifest, dict):
        raise ValidationError("validation.input_gate must be an object")

    allowed_keys = {"task_context", "direct_rules", "depends_on"}
    unknown_keys = set(manifest) - allowed_keys
    if unknown_keys:
        raise ValidationError(
            f"non-Issue input keys are not allowed: {', '.join(sorted(unknown_keys))}"
        )

    return manifest


def validate_issue_metadata(issue: str, url: str, updated_at: str) -> None:
    issue = require_string(issue, "issue")
    url = require_string(url, "issue URL")
    updated_at = require_string(updated_at, "issue updatedAt")
    issue_match = ISSUE_ID_PATTERN.fullmatch(issue)
    if issue_match is None:
        raise ValidationError("issue must use owner/repo#number format")

    expected_url = (
        "https://github.com/"
        f"{issue_match.group('owner')}/{issue_match.group('repo')}"
        f"/issues/{issue_match.group('number')}"
    )
    if url != expected_url:
        raise ValidationError("issue URL does not match the issue identifier")

    if RFC3339_UTC_PATTERN.fullmatch(updated_at) is None:
        raise ValidationError("issue updatedAt must be an RFC 3339 UTC timestamp")
    try:
        datetime.fromisoformat(f"{updated_at[:-1]}+00:00")
    except ValueError as error:
        raise ValidationError(
            "issue updatedAt must be an RFC 3339 UTC timestamp"
        ) from error


def validate_task_context(
    task_context: Any,
    issue_body: bytes,
    issue: str,
    issue_url: str,
    issue_updated_at: str,
) -> None:
    if not isinstance(task_context, dict):
        raise ValidationError("task_context must be an object")

    required_keys = {"source", "issue", "url", "updated_at", "body_sha256"}
    if set(task_context) != required_keys:
        raise ValidationError(
            "task_context must contain only source, issue, url, updated_at, "
            "body_sha256"
        )

    if task_context["source"] != "issue_body":
        raise ValidationError("task_context.source must be issue_body")

    expected_metadata = {
        "issue": issue,
        "url": issue_url,
        "updated_at": issue_updated_at,
    }
    for key, expected_value in expected_metadata.items():
        actual_value = require_string(task_context[key], f"task_context.{key}")
        if actual_value != expected_value:
            raise ValidationError(
                f"task_context.{key} does not match the fetched Issue metadata"
            )

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
            "each direct rule must contain id, issue_evidence, match, reason "
            "and optional explicit_surface"
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
    if normalize(value) not in normalize(evidence):
        raise ValidationError(
            f"{rule_id}.match.value must be present in Issue evidence"
        )

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

    dependencies: dict[str, str] = {}
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {"id", "via"}:
            raise ValidationError("each depends_on entry must contain only id and via")
        rule_id = require_string(entry["id"], "depends_on.id")
        via = require_string(entry["via"], f"{rule_id}.via")
        if rule_id in dependencies or rule_id in direct_rule_ids:
            raise ValidationError(f"duplicate rule-map node: {rule_id}")
        if rule_id not in rules_by_id:
            raise ValidationError(f"unknown depends_on node: {rule_id}")
        dependencies[rule_id] = via

    required_dependencies: set[str] = set()
    traversed: set[str] = set()
    pending = list(direct_rule_ids)
    while pending:
        rule_id = pending.pop()
        if rule_id in traversed:
            continue
        traversed.add(rule_id)
        for dependency_id in rules_by_id[rule_id].get("depends_on", []):
            if dependency_id not in rules_by_id:
                raise ValidationError(
                    f"unknown rule-map dependency: {rule_id} -> {dependency_id}"
                )
            if dependency_id not in direct_rule_ids:
                required_dependencies.add(dependency_id)
            pending.append(dependency_id)

    declared_dependencies = set(dependencies)
    missing = required_dependencies - declared_dependencies
    if missing:
        raise ValidationError(
            f"depends_on is missing required nodes: {', '.join(sorted(missing))}"
        )
    unexpected = declared_dependencies - required_dependencies
    if unexpected:
        raise ValidationError(
            f"depends_on contains nodes outside the required closure: "
            f"{', '.join(sorted(unexpected))}"
        )

    selected_rule_ids = direct_rule_ids | declared_dependencies
    for rule_id, via in dependencies.items():
        if via not in selected_rule_ids:
            raise ValidationError(f"{rule_id}.via must reference a selected rule-map node")
        if rule_id not in rules_by_id[via].get("depends_on", []):
            raise ValidationError(
                f"rule-map does not declare depends_on edge: {via} -> {rule_id}"
            )

    reachable = set(direct_rule_ids)
    while True:
        newly_reachable = {
            rule_id
            for rule_id, via in dependencies.items()
            if via in reachable and rule_id not in reachable
        }
        if not newly_reachable:
            break
        reachable.update(newly_reachable)

    disconnected = declared_dependencies - reachable
    if disconnected:
        raise ValidationError(
            f"depends_on contains nodes disconnected from direct rules: "
            f"{', '.join(sorted(disconnected))}"
        )


def validate(
    issue_body_path: Path,
    document_path: Path,
    rule_map_path: Path,
    issue: str,
    issue_url: str,
    issue_updated_at: str,
    document_kind: str,
    repo_root: Path,
    goal_document_path: Path | None = None,
    require_goal_document: bool = True,
) -> None:
    canonical_rule_map_path = require_canonical_input(
        repo_root,
        rule_map_path,
        Path("docs/harness/rule-map.json"),
        "rule-map",
    )
    if document_kind == "goal":
        source = load_source(document_path, "requirements_goal")
    elif document_kind == "artifact":
        source = load_source(document_path, "requirements")
        require_canonical_input(
            repo_root,
            document_path,
            canonical_source_path(Path(), source["workspace"], "requirements"),
            "Requirements source",
        )
    else:
        raise ValidationError("document kind must be goal or artifact")
    if source["validation"].get("mode") != "managed":
        raise ValidationError("normal validation requires validation.mode=managed")
    issue_body_bytes = issue_body_path.read_bytes()
    issue_body = issue_body_bytes.decode("utf-8")
    rule_map = json.loads(canonical_rule_map_path.read_text(encoding="utf-8"))
    rules_by_id = validate_rule_map(rule_map)
    manifest = extract_manifest(source)

    validate_issue_metadata(issue, issue_url, issue_updated_at)
    validate_task_context(
        manifest.get("task_context"),
        issue_body_bytes,
        issue,
        issue_url,
        issue_updated_at,
    )

    direct_rules = manifest.get("direct_rules")
    if not isinstance(direct_rules, list):
        raise ValidationError("direct_rules must be an array")
    if not direct_rules:
        raise ValidationError("direct_rules must contain at least one Issue-evidenced rule")
    direct_rule_ids = {
        validate_direct_rule(entry, issue_body, rules_by_id) for entry in direct_rules
    }
    if len(direct_rule_ids) != len(direct_rules):
        raise ValidationError("direct_rules contains duplicate ids")

    validate_dependencies(manifest.get("depends_on"), direct_rule_ids, rules_by_id)

    if document_kind == "goal":
        if goal_document_path is not None:
            raise ValidationError("--goal-document is only valid for artifact validation")
        return
    if not require_goal_document:
        if goal_document_path is not None:
            raise ValidationError(
                "goal document must be omitted when only revalidating the artifact gate"
            )
        return
    if goal_document_path is None:
        raise ValidationError("artifact validation requires --goal-document")
    if goal_document_path.resolve() == document_path.resolve():
        raise ValidationError("--goal-document must be distinct from the artifact")
    goal_source = load_source(goal_document_path, "requirements_goal")
    if goal_source["validation"].get("mode") != "managed":
        raise ValidationError("normal validation requires validation.mode=managed")
    goal_manifest = extract_manifest(goal_source)
    if manifest != goal_manifest:
        raise ValidationError(
            "artifact Requirements Input Gate does not match the Goal"
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--issue", required=True)
    parser.add_argument("--issue-url", required=True)
    parser.add_argument("--issue-updated-at", required=True)
    parser.add_argument("--issue-body", required=True, type=Path)
    parser.add_argument("--document", required=True, type=Path)
    parser.add_argument("--rule-map", required=True, type=Path)
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--kind", required=True, choices=("goal", "artifact"))
    parser.add_argument("--goal-document", type=Path)
    args = parser.parse_args()

    try:
        validate(
            args.issue_body,
            args.document,
            args.rule_map,
            args.issue,
            args.issue_url,
            args.issue_updated_at,
            args.kind,
            args.repo_root,
            args.goal_document,
        )
    except (
        OSError,
        UnicodeDecodeError,
        KeyError,
        json.JSONDecodeError,
        GitBaselineError,
        SourceError,
        ValidationError,
    ) as error:
        print(f"requirements input gate: failed: {error}", file=sys.stderr)
        return 1

    print("requirements input gate: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
