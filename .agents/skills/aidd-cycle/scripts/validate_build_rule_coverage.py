#!/usr/bin/env python3
"""Validate Build rule coverage from the actual Git diff."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

from artifact_source import (
    decode_source_json,
    read_regular_file_bytes,
    write_regular_file_atomically,
)
from git_baseline import (
    GitBaselineError,
    require_canonical_worktree_path,
    require_repository_root,
    run_git,
)
from rule_coverage import (
    RuleCoverageError,
    expand_rule_closure,
    matching_surfaces,
    path_is_governed,
    rules_for_surfaces,
    validate_review_routing,
)
from validate_build_entry import canonical_receipt_path
from validate_requirements_goal import ValidationError as RuleMapValidationError
from validate_requirements_goal import validate_rule_map


COVERAGE_SCHEMA_VERSION = 1
COVERAGE_RELATIVE_PATH = Path(".aidd") / "build-rule-coverage.json"


class ValidationError(ValueError):
    pass


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_coverage_path(repo_root: Path, workspace: str) -> Path:
    return (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / workspace
        / COVERAGE_RELATIVE_PATH
    )


def run_checked_git(repo_root: Path, arguments: list[str], label: str) -> str:
    result = run_git(repo_root, arguments)
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise ValidationError(f"{label} failed: {detail or 'unknown Git error'}")
    return result.stdout.decode("utf-8")


def changed_paths(repo_root: Path, baseline_head: str) -> list[dict[str, str]]:
    run_checked_git(
        repo_root,
        ["cat-file", "-e", f"{baseline_head}^{{commit}}"],
        "build baseline lookup",
    )
    run_checked_git(
        repo_root,
        ["merge-base", "--is-ancestor", baseline_head, "HEAD"],
        "build baseline ancestry check",
    )
    output = run_checked_git(
        repo_root,
        ["diff", "--name-status", "--find-renames", baseline_head, "--"],
        "build diff inspection",
    )
    changes: list[dict[str, str]] = []
    for line in output.splitlines():
        fields = line.split("\t")
        status = fields[0]
        if status.startswith(("R", "C")) and len(fields) == 3:
            changes.append({"status": "D", "path": fields[1]})
            changes.append({"status": "A", "path": fields[2]})
        elif len(fields) == 2:
            changes.append({"status": status[0], "path": fields[1]})
        else:
            raise ValidationError(f"unsupported Git name-status record: {line}")
    untracked = run_checked_git(
        repo_root,
        ["ls-files", "--others", "--exclude-standard"],
        "untracked file inspection",
    )
    tracked_paths = {entry["path"] for entry in changes}
    changes.extend(
        {"status": "A", "path": path}
        for path in untracked.splitlines()
        if path and path not in tracked_paths
    )
    return sorted(changes, key=lambda entry: (entry["path"], entry["status"]))


def load_receipt(
    repo_root: Path,
    workspace: str,
    expected_receipt_sha256: str,
) -> tuple[dict[str, Any], bytes]:
    receipt_path = canonical_receipt_path(repo_root, workspace)
    receipt_bytes = read_regular_file_bytes(receipt_path)
    if sha256_bytes(receipt_bytes) != expected_receipt_sha256:
        raise ValidationError(
            "Design completion receipt SHA-256 does not match Build Goal evidence"
        )
    try:
        receipt = decode_source_json(receipt_bytes.decode("utf-8"))
    except UnicodeDecodeError as error:
        raise ValidationError("Design completion receipt must be UTF-8 JSON") from error
    if not isinstance(receipt, dict) or receipt.get("schema_version") != 2:
        raise ValidationError("Build rule coverage requires receipt schema_version 2")
    if receipt.get("workspace") != workspace:
        raise ValidationError("Design completion receipt workspace does not match")
    return receipt, receipt_bytes


def validate(
    repo_root: Path,
    workspace: str,
    expected_receipt_sha256: str,
) -> dict[str, Any]:
    repo_root = require_repository_root(repo_root)
    receipt, receipt_bytes = load_receipt(
        repo_root,
        workspace,
        expected_receipt_sha256,
    )
    rule_map_path = require_canonical_worktree_path(
        repo_root,
        repo_root / "docs" / "harness" / "rule-map.json",
        Path("docs/harness/rule-map.json"),
        "rule-map",
    )
    rule_map_bytes = read_regular_file_bytes(rule_map_path)
    if sha256_bytes(rule_map_bytes) != receipt["rule_map"]["sha256"]:
        raise ValidationError("canonical rule-map changed after Design completion")
    try:
        rule_map = decode_source_json(rule_map_bytes.decode("utf-8"))
        rules_by_id = validate_rule_map(rule_map)
        routing = validate_review_routing(rule_map, rules_by_id)
    except (UnicodeDecodeError, RuleMapValidationError, RuleCoverageError) as error:
        raise ValidationError(f"canonical rule-map is invalid: {error}") from error

    selected_rules = [entry["id"] for entry in receipt["selected_rules"]]
    declared_surfaces = receipt["rule_coverage"]["implementation_surfaces"]
    baseline_head = receipt["build_baseline"]["head"]
    governed_changes: list[dict[str, Any]] = []
    actual_surfaces: list[str] = []
    for change in changed_paths(repo_root, baseline_head):
        path = change["path"]
        if not path_is_governed(path, routing):
            continue
        matched = matching_surfaces(path, routing)
        if not matched:
            raise ValidationError(
                f"governed Build path has no review surface: {path}"
            )
        governed_changes.append({**change, "surfaces": matched})
        actual_surfaces.extend(matched)
    actual_surfaces = list(dict.fromkeys(actual_surfaces))
    undeclared = set(actual_surfaces) - set(declared_surfaces)
    if undeclared:
        raise ValidationError(
            "actual Build diff requires undeclared Design surfaces: "
            f"{', '.join(sorted(undeclared))}"
        )
    try:
        required_rules = expand_rule_closure(
            rules_for_surfaces(actual_surfaces, routing),
            rules_by_id,
        )
    except RuleCoverageError as error:
        raise ValidationError(str(error)) from error
    missing_rules = set(required_rules) - set(selected_rules)
    if missing_rules:
        raise ValidationError(
            "actual Build diff requires rules absent from the Design receipt: "
            f"{', '.join(sorted(missing_rules))}"
        )
    return {
        "schema_version": COVERAGE_SCHEMA_VERSION,
        "kind": "build_rule_coverage",
        "workspace": workspace,
        "receipt_sha256": sha256_bytes(receipt_bytes),
        "build_baseline_head": baseline_head,
        "changes": governed_changes,
        "implementation_surfaces": actual_surfaces,
        "checked_rules": required_rules,
        "unresolved": [],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--expected-receipt-sha256", required=True)
    args = parser.parse_args()
    try:
        record = validate(
            args.repo_root,
            args.workspace,
            args.expected_receipt_sha256,
        )
        output_path = canonical_coverage_path(args.repo_root, args.workspace)
        serialized = f"{json.dumps(record, ensure_ascii=False, indent=2)}\n"
        write_regular_file_atomically(output_path, serialized)
    except (
        KeyError,
        OSError,
        TypeError,
        UnicodeDecodeError,
        GitBaselineError,
        ValidationError,
    ) as error:
        print(f"build rule coverage: failed: {error}", file=sys.stderr)
        return 1
    print(f"build rule coverage: verified: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
