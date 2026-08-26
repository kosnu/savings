#!/usr/bin/env python3
"""Validate Build rule coverage from the actual Git diff."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

sys.dont_write_bytecode = True

from artifact_source import (
    SourceError,
    canonical_workspace_path,
    decode_source_json,
    inventory_owned_paths,
    read_regular_file_bytes,
    require_substantive_inline_text,
    structured_sha256,
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
    resolve_path_coverage,
    rules_for_surfaces,
    validate_review_routing,
)
from validate_build_entry import canonical_receipt_path
from validate_requirements_goal import ValidationError as RuleMapValidationError
from validate_requirements_goal import validate_rule_map


COVERAGE_SCHEMA_VERSION = 3
COVERAGE_RELATIVE_PATH = Path(".aidd") / "build-rule-coverage.json"
VERIFICATION_RELATIVE_PATH = Path(".aidd") / "build-verification.json"
VERIFICATION_GENERATOR = "capture_build_verification.py/v2"


class ValidationError(ValueError):
    pass


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_coverage_path(repo_root: Path, workspace: str) -> Path:
    return canonical_workspace_path(
        repo_root,
        workspace,
        COVERAGE_RELATIVE_PATH.as_posix(),
    )


def canonical_verification_path(repo_root: Path, workspace: str) -> Path:
    return canonical_workspace_path(
        repo_root,
        workspace,
        VERIFICATION_RELATIVE_PATH.as_posix(),
    )


def load_verification_results(
    repo_root: Path,
    workspace: str,
    receipt_sha256: str,
    target_state: dict[str, Any],
) -> tuple[list[dict[str, Any]], bytes]:
    path = canonical_verification_path(repo_root, workspace)
    raw = read_regular_file_bytes(path)
    try:
        source = decode_source_json(raw.decode("utf-8"))
    except UnicodeDecodeError as error:
        raise ValidationError("Build verification evidence must be UTF-8 JSON") from error
    if not isinstance(source, dict) or set(source) != {
        "schema_version",
        "kind",
        "workspace",
        "receipt_sha256",
        "final_state_sha256",
        "generator",
        "results",
    }:
        raise ValidationError("Build verification evidence has invalid keys")
    if source["schema_version"] != 3 or source["kind"] != "build_verification":
        raise ValidationError("Build verification evidence requires schema_version 3")
    if source["workspace"] != workspace or source["receipt_sha256"] != receipt_sha256:
        raise ValidationError("Build verification evidence identity does not match")
    if source["generator"] != VERIFICATION_GENERATOR:
        raise ValidationError("Build verification evidence must use the repository generator")
    try:
        expected_final_state = final_state_sha256(repo_root, target_state)
    except SourceError as error:
        raise ValidationError(str(error)) from error
    if source["final_state_sha256"] != expected_final_state:
        raise ValidationError("Build verification evidence does not match the current final state")
    expected_ids = [entry["id"] for entry in target_state["verification_cases"]]
    results = source["results"]
    if not isinstance(results, list) or [
        entry.get("id") if isinstance(entry, dict) else None for entry in results
    ] != expected_ids:
        raise ValidationError("Build verification must cover every target verification case in order")
    for index, (case, entry) in enumerate(
        zip(target_state["verification_cases"], results, strict=True)
    ):
        if case["type"] == "automated":
            if set(entry) != {
                "id",
                "type",
                "status",
                "command",
                "exit_code",
                "stdout_bytes",
                "stderr_bytes",
                "output_sha256",
            }:
                raise ValidationError(
                    f"automated Build verification result {index} has invalid keys"
                )
            digest = entry["output_sha256"]
            if (
                entry["type"] != "automated"
                or entry["status"] != "passed"
                or entry["command"] != case["command"]
                or type(entry["exit_code"]) is not int
                or entry["exit_code"] != 0
                or type(entry["stdout_bytes"]) is not int
                or entry["stdout_bytes"] < 0
                or type(entry["stderr_bytes"]) is not int
                or entry["stderr_bytes"] < 0
                or not isinstance(digest, str)
                or re.fullmatch(r"[0-9a-f]{64}", digest) is None
            ):
                raise ValidationError(
                    f"automated verification evidence does not match target: {entry['id']}"
                )
        else:
            if set(entry) != {
                "id",
                "type",
                "status",
                "procedure",
                "observation",
            }:
                raise ValidationError(
                    f"manual Build verification result {index} has invalid keys"
                )
            try:
                observation = require_substantive_inline_text(
                    entry["observation"],
                    f"manual Build verification observation {entry['id']}",
                )
            except SourceError as error:
                raise ValidationError(str(error)) from error
            if (
                entry["type"] != "manual"
                or entry["status"] != "passed"
                or entry["procedure"] != case["procedure"]
                or observation != entry["observation"]
            ):
                raise ValidationError(
                    f"manual verification evidence does not match target: {entry['id']}"
                )
    return results, raw


def representation_identity(entry: dict[str, Any]) -> tuple[str, str, str]:
    locator = entry["locator"]
    return entry["path"], locator["kind"], locator.get("name", "")


def final_state_sha256(repo_root: Path, target_state: dict[str, Any]) -> str:
    inventory = inventory_owned_paths(repo_root, target_state)
    files = [
        {
            "path": path,
            "sha256": sha256_bytes(read_regular_file_bytes(repo_root / path)),
        }
        for path in inventory
    ]
    return structured_sha256(
        {
            "target_state_sha256": structured_sha256(target_state),
            "files": files,
        }
    )


def extract_typescript_representations(
    text: str,
    mode: str,
    path: str = "representation.tsx",
) -> list[str]:
    extractor = Path(__file__).with_name("extract_typescript_representations.mjs")
    result = subprocess.run(
        ["node", str(extractor)],
        input=json.dumps({"mode": mode, "path": path, "text": text}),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or "representation extractor failed"
        raise ValidationError(detail)
    try:
        values = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise ValidationError("representation extractor returned invalid JSON") from error
    if not isinstance(values, list) or any(
        not isinstance(value, str) or not value for value in values
    ):
        raise ValidationError("representation extractor returned invalid names")
    return values


def exported_names(text: str, path: str = "representation.tsx") -> list[str]:
    return extract_typescript_representations(text, "exports", path)


def literal_test_case_names(text: str, path: str = "representation.tsx") -> list[str]:
    return extract_typescript_representations(text, "tests", path)


def validate_final_target_state(
    repo_root: Path,
    target_state: dict[str, Any],
) -> tuple[list[str], list[dict[str, str]]]:
    try:
        current_paths = inventory_owned_paths(repo_root, target_state)
    except SourceError as error:
        raise ValidationError(str(error)) from error
    representations = target_state["representations"]
    target_paths = {entry["path"] for entry in representations}
    source_bytes_by_path: dict[str, bytes] = {}
    missing_paths: list[str] = []
    for path in sorted(target_paths):
        try:
            source_bytes_by_path[path] = read_regular_file_bytes(repo_root / path)
        except (OSError, SourceError):
            missing_paths.append(path)
    if missing_paths:
        raise ValidationError(
            "target representations are missing: " + ", ".join(missing_paths)
        )
    extra_paths = sorted(set(current_paths) - target_paths)
    if extra_paths:
        raise ValidationError(
            "task-owned paths absent from target state remain: " + ", ".join(extra_paths)
        )

    expected_by_path: dict[str, set[tuple[str, str, str]]] = {}
    for entry in representations:
        expected_by_path.setdefault(entry["path"], set()).add(
            representation_identity(entry)
        )
    actual_records: list[dict[str, str]] = []
    for path in sorted(expected_by_path):
        expected = expected_by_path[path]
        locator_kinds = {identity[1] for identity in expected}
        if locator_kinds == {"file"}:
            actual_records.append({"path": path, "locator": "file", "name": ""})
            continue
        try:
            text = source_bytes_by_path[path].decode("utf-8")
        except UnicodeDecodeError as error:
            raise ValidationError(f"granular representation must be UTF-8: {path}") from error
        actual_entries: list[tuple[str, str, str]] = []
        if "export" in locator_kinds:
            actual_entries.extend(
                (path, "export", name) for name in exported_names(text, path)
            )
        if "test_case" in locator_kinds:
            actual_entries.extend(
                (path, "test_case", name)
                for name in literal_test_case_names(text, path)
            )
        if len(actual_entries) != len(set(actual_entries)):
            raise ValidationError(
                f"granular representation locators must be unique in {path}"
            )
        actual = set(actual_entries)
        if actual != expected:
            missing = sorted(expected - actual)
            extra = sorted(actual - expected)
            detail = []
            if missing:
                detail.append(f"missing={missing}")
            if extra:
                detail.append(f"extra={extra}")
            raise ValidationError(
                f"final representations do not match target state for {path}: "
                + "; ".join(detail)
            )
        actual_records.extend(
            {"path": identity[0], "locator": identity[1], "name": identity[2]}
            for identity in sorted(actual)
        )
    return current_paths, actual_records


def run_checked_git(repo_root: Path, arguments: list[str], label: str) -> str:
    result = run_git(repo_root, arguments)
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise ValidationError(f"{label} failed: {detail or 'unknown Git error'}")
    return result.stdout.decode("utf-8")


def require_git_visible_paths(repo_root: Path, paths: list[str]) -> None:
    for path in sorted(set(paths)):
        result = run_git(repo_root, ["check-ignore", "-q", "--", path])
        if result.returncode == 0:
            raise ValidationError(
                f"task-owned path must be visible to Git diff inspection: {path}"
            )
        if result.returncode != 1:
            detail = result.stderr.decode("utf-8", errors="replace").strip()
            raise ValidationError(
                f"Git visibility check failed for task-owned path {path}: "
                f"{detail or 'unknown Git error'}"
            )


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
    if not isinstance(receipt, dict) or receipt.get("schema_version") != 3:
        raise ValidationError("Build rule coverage requires receipt schema_version 3")
    if receipt.get("workspace") != workspace:
        raise ValidationError("Design completion receipt workspace does not match")
    target_record = receipt.get("target_state")
    ownership_record = receipt.get("ownership_scopes")
    if not isinstance(target_record, dict) or set(target_record) != {"sha256", "value"}:
        raise ValidationError("Design receipt target_state record is invalid")
    if not isinstance(ownership_record, dict) or set(ownership_record) != {
        "sha256",
        "value",
    }:
        raise ValidationError("Design receipt ownership scope record is invalid")
    target_state = target_record["value"]
    ownership_scopes = ownership_record["value"]
    if target_record["sha256"] != structured_sha256(target_state):
        raise ValidationError("Design receipt target_state hash does not match")
    if ownership_record["sha256"] != structured_sha256(ownership_scopes):
        raise ValidationError("Design receipt ownership scope hash does not match")
    if not isinstance(target_state, dict) or ownership_scopes != target_state.get(
        "ownership_scopes"
    ):
        raise ValidationError("Design receipt ownership scopes do not match target state")
    return receipt, receipt_bytes


def validate(
    repo_root: Path,
    workspace: str,
    expected_receipt_sha256: str,
) -> dict[str, Any]:
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
    rule_coverage = receipt["rule_coverage"]["value"]
    if receipt["rule_coverage"]["sha256"] != structured_sha256(rule_coverage):
        raise ValidationError("Design receipt rule_coverage hash does not match")
    declared_surfaces = rule_coverage["implementation_surfaces"]
    baseline_head = receipt["build_baseline"]["head"]
    target_state = receipt["target_state"]["value"]
    ownership_scopes = receipt["ownership_scopes"]["value"]
    baseline_inventory = receipt["baseline_inventory"]["value"]
    if receipt["baseline_inventory"]["sha256"] != structured_sha256(
        baseline_inventory
    ):
        raise ValidationError("Design receipt baseline inventory hash does not match")
    current_inventory, actual_representations = validate_final_target_state(
        repo_root, target_state
    )
    require_git_visible_paths(
        repo_root,
        [
            *current_inventory,
            *(entry["path"] for entry in target_state["ownership_scopes"]),
            *(entry["path"] for entry in target_state["representations"]),
        ],
    )
    receipt_sha256 = sha256_bytes(receipt_bytes)
    verification_results, verification_bytes = load_verification_results(
        repo_root, workspace, receipt_sha256, target_state
    )
    all_changes = changed_paths(repo_root, baseline_head)
    workflow_paths = {
        receipt["artifacts"][kind][part]["path"]
        for kind in ("requirements", "design")
        for part in ("source", "display")
    } | {
        canonical_receipt_path(repo_root, workspace).relative_to(repo_root).as_posix(),
        canonical_verification_path(repo_root, workspace).relative_to(repo_root).as_posix(),
        canonical_coverage_path(repo_root, workspace).relative_to(repo_root).as_posix(),
    }
    build_changes = [
        change for change in all_changes if change["path"] not in workflow_paths
    ]
    out_of_scope = [
        change["path"]
        for change in build_changes
        if not any(
            change["path"] == scope["path"]
            or (
                scope["kind"] == "tree"
                and change["path"].startswith(f"{scope['path']}/")
            )
            for scope in target_state["ownership_scopes"]
        )
    ]
    if out_of_scope:
        raise ValidationError(
            "actual Build diff exceeds task-owned scope: "
            + ", ".join(sorted(out_of_scope))
        )
    resolved_changes: list[dict[str, Any]] = []
    actual_surfaces: list[str] = []
    actual_path_rules: list[str] = []
    for change in build_changes:
        path = change["path"]
        try:
            resolution = resolve_path_coverage(path, routing, rules_by_id)
        except RuleCoverageError as error:
            raise ValidationError(str(error)) from error
        resolved_changes.append(
            {
                **change,
                "governed": resolution["governed"],
                "surfaces": resolution["surfaces"],
                "path_rules": resolution["path_rules"],
            }
        )
        actual_surfaces.extend(resolution["surfaces"])
        actual_path_rules.extend(resolution["path_rules"])
    actual_surfaces = list(dict.fromkeys(actual_surfaces))
    undeclared = set(actual_surfaces) - set(declared_surfaces)
    if undeclared:
        raise ValidationError(
            "actual Build diff requires undeclared Design surfaces: "
            f"{', '.join(sorted(undeclared))}"
        )
    try:
        direct_rule_set = set(rules_for_surfaces(actual_surfaces, routing)) | set(
            actual_path_rules
        )
        direct_rules = [
            rule_id for rule_id in rules_by_id if rule_id in direct_rule_set
        ]
        required_rules = expand_rule_closure(
            direct_rules,
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
        "receipt_sha256": receipt_sha256,
        "target_state_sha256": receipt["target_state"]["sha256"],
        "build_baseline_head": baseline_head,
        "baseline_inventory": baseline_inventory,
        "final_inventory": current_inventory,
        "representations": actual_representations,
        "verification": {
            "sha256": sha256_bytes(verification_bytes),
            "results": verification_results,
        },
        "changes": resolved_changes,
        "implementation_surfaces": actual_surfaces,
        "direct_rules": direct_rules,
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
        repo_root = require_repository_root(args.repo_root)
        record = validate(
            repo_root,
            args.workspace,
            args.expected_receipt_sha256,
        )
        output_path = canonical_coverage_path(repo_root, args.workspace)
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
