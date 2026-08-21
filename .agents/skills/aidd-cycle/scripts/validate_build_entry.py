#!/usr/bin/env python3
"""Verify the immutable Design-to-Build artifact handoff."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from artifact_source import (
    SourceError,
    canonical_display_path,
    canonical_source_path,
    decode_source_json,
    load_source_bytes,
    normalize_markdown_newlines,
    read_regular_file_bytes,
    write_regular_file_atomically,
)
from git_baseline import (
    GitBaselineError,
    load_git_head_source,
    require_canonical_worktree_path,
    require_repository_root,
)
from render_aidd_artifact import render_artifact_markdown
from validate_design_coverage import (
    ValidationError as DesignValidationError,
    load_selected_rule_records,
    validate as validate_design_artifact,
)


RECEIPT_SCHEMA_VERSION = 1
RECEIPT_RELATIVE_PATH = Path(".aidd") / "design-completion.json"


class ValidationError(ValueError):
    pass


@dataclass(frozen=True)
class HandoffSnapshot:
    issue_body: bytes
    rule_map: bytes
    requirements: bytes
    design: bytes
    requirements_baseline: bytes | None
    design_baseline: bytes | None
    requirements_display: bytes
    design_display: bytes
    selected_rules: dict[str, dict[str, Any]]
    design_goal: bytes | None = None
    receipt: bytes | None = None


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_receipt_path(repo_root: Path, workspace: str) -> Path:
    return (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / workspace
        / RECEIPT_RELATIVE_PATH
    )


def artifact_record(
    repo_root: Path,
    workspace: str,
    kind: str,
    source_bytes: bytes,
    display_bytes: bytes,
) -> dict[str, Any]:
    source_path = canonical_source_path(repo_root, workspace, kind)
    display_path = canonical_display_path(repo_root, workspace, kind)
    return {
        "source": {
            "path": source_path.relative_to(repo_root).as_posix(),
            "sha256": sha256_bytes(source_bytes),
        },
        "display": {
            "path": display_path.relative_to(repo_root).as_posix(),
            "sha256": sha256_bytes(display_bytes),
        },
    }


def selected_rule_receipt_records(
    snapshot: HandoffSnapshot,
) -> list[dict[str, str]]:
    return [
        {
            "id": record["id"],
            "path": record["path"],
            "sha256": record["sha256"],
        }
        for record in snapshot.selected_rules.values()
    ]


def read_handoff_snapshot(
    repo_root: Path,
    workspace: str,
    issue_body_path: Path,
    rule_map_path: Path,
    *,
    goal_document_path: Path | None = None,
    receipt_path: Path | None = None,
) -> HandoffSnapshot:
    canonical_rule_map_path = require_canonical_worktree_path(
        repo_root,
        rule_map_path,
        Path("docs/harness/rule-map.json"),
        "rule-map",
    )
    requirements = read_regular_file_bytes(
        canonical_source_path(repo_root, workspace, "requirements")
    )
    rule_map = read_regular_file_bytes(canonical_rule_map_path)
    requirements_source = load_source_bytes(requirements, "requirements")
    selected_rules = load_selected_rule_records(
        repo_root,
        rule_map,
        requirements_source,
    )
    _, requirements_baseline = load_git_head_source(
        repo_root,
        workspace,
        "requirements",
    )
    _, design_baseline = load_git_head_source(repo_root, workspace, "design")
    for record in selected_rules.values():
        record["bytes"] = record["text"].encode("utf-8")
    return HandoffSnapshot(
        issue_body=read_regular_file_bytes(issue_body_path),
        rule_map=rule_map,
        requirements=requirements,
        design=read_regular_file_bytes(
            canonical_source_path(repo_root, workspace, "design")
        ),
        requirements_baseline=requirements_baseline,
        design_baseline=design_baseline,
        requirements_display=read_regular_file_bytes(
            canonical_display_path(repo_root, workspace, "requirements")
        ),
        design_display=read_regular_file_bytes(
            canonical_display_path(repo_root, workspace, "design")
        ),
        selected_rules=selected_rules,
        design_goal=(
            read_regular_file_bytes(goal_document_path)
            if goal_document_path is not None
            else None
        ),
        receipt=(
            read_regular_file_bytes(receipt_path)
            if receipt_path is not None
            else None
        ),
    )


def build_receipt(
    repo_root: Path,
    issue: str,
    issue_url: str,
    issue_updated_at: str,
    snapshot: HandoffSnapshot,
    rule_map_path: Path,
    workspace: str,
    design_goal_sha256: str,
) -> dict[str, Any]:
    requirements_source = load_source_bytes(snapshot.requirements, "requirements")
    issue_title = requirements_source["validation"]["cycle_start_issue_title"]
    return {
        "schema_version": RECEIPT_SCHEMA_VERSION,
        "kind": "design_completion",
        "issue": {
            "id": issue,
            "title": issue_title,
            "url": issue_url,
            "updated_at": issue_updated_at,
            "body_sha256": sha256_bytes(snapshot.issue_body),
        },
        "workspace": workspace,
        "design_goal_sha256": design_goal_sha256,
        "rule_map": {
            "path": rule_map_path.relative_to(repo_root).as_posix(),
            "sha256": sha256_bytes(snapshot.rule_map),
        },
        "selected_rules": selected_rule_receipt_records(snapshot),
        "artifacts": {
            "requirements": artifact_record(
                repo_root,
                workspace,
                "requirements",
                snapshot.requirements,
                snapshot.requirements_display,
            ),
            "design": artifact_record(
                repo_root,
                workspace,
                "design",
                snapshot.design,
                snapshot.design_display,
            ),
        },
    }


def serialize_receipt(receipt: dict[str, Any]) -> str:
    return f"{json.dumps(receipt, ensure_ascii=False, indent=2)}\n"


def require_digest(value: Any, label: str) -> str:
    if (
        not isinstance(value, str)
        or len(value) != 64
        or any(character not in "0123456789abcdef" for character in value)
    ):
        raise ValidationError(f"{label} must be a lowercase SHA-256 digest")
    return value


def validate_display_snapshot(
    source_bytes: bytes,
    display_bytes: bytes,
    kind: str,
) -> None:
    source = load_source_bytes(source_bytes, kind)
    expected = render_artifact_markdown(source)
    try:
        current = display_bytes.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValidationError(f"generated {kind} Markdown must be UTF-8") from error
    if normalize_markdown_newlines(current) != normalize_markdown_newlines(expected):
        raise ValidationError(f"generated {kind} Markdown is stale")


def assert_snapshot_current(
    snapshot: HandoffSnapshot,
    repo_root: Path,
    workspace: str,
    issue_body_path: Path,
    rule_map_path: Path,
    goal_document_path: Path | None,
) -> None:
    inputs: list[tuple[str, Path, bytes]] = [
        ("Issue body", issue_body_path, snapshot.issue_body),
        ("rule map", rule_map_path, snapshot.rule_map),
        (
            "Requirements source",
            canonical_source_path(repo_root, workspace, "requirements"),
            snapshot.requirements,
        ),
        (
            "Design source",
            canonical_source_path(repo_root, workspace, "design"),
            snapshot.design,
        ),
        (
            "Requirements display",
            canonical_display_path(repo_root, workspace, "requirements"),
            snapshot.requirements_display,
        ),
        (
            "Design display",
            canonical_display_path(repo_root, workspace, "design"),
            snapshot.design_display,
        ),
    ]
    if snapshot.design_goal is not None:
        if goal_document_path is None:
            raise ValidationError("Design Goal snapshot has no retained Goal path")
        inputs.append(("retained Design Goal", goal_document_path, snapshot.design_goal))
    inputs.extend(
        (
            f"selected rule {record['id']}",
            repo_root / record["path"],
            record["bytes"],
        )
        for record in snapshot.selected_rules.values()
    )
    for label, path, expected in inputs:
        if read_regular_file_bytes(path) != expected:
            raise ValidationError(f"{label} changed after the handoff snapshot")
    _, current_requirements_baseline = load_git_head_source(
        repo_root,
        workspace,
        "requirements",
    )
    _, current_design_baseline = load_git_head_source(repo_root, workspace, "design")
    if current_requirements_baseline != snapshot.requirements_baseline:
        raise ValidationError("Requirements Git HEAD baseline changed after the handoff snapshot")
    if current_design_baseline != snapshot.design_baseline:
        raise ValidationError("Design Git HEAD baseline changed after the handoff snapshot")


def validate_or_capture(
    issue: str,
    issue_url: str,
    issue_updated_at: str,
    issue_body_path: Path,
    rule_map_path: Path,
    repo_root: Path,
    workspace: str,
    *,
    capture: bool,
    goal_document_path: Path | None = None,
    expected_receipt_sha256: str | None = None,
) -> tuple[Path, str]:
    repo_root = require_repository_root(repo_root)
    requirements_path = canonical_source_path(repo_root, workspace, "requirements")
    design_path = canonical_source_path(repo_root, workspace, "design")
    canonical_rule_map_path = repo_root / "docs" / "harness" / "rule-map.json"
    receipt_path = canonical_receipt_path(repo_root, workspace)
    if capture:
        if goal_document_path is None:
            raise ValidationError(
                "Design completion capture requires the retained Design Goal JSON"
            )
        snapshot = read_handoff_snapshot(
            repo_root,
            workspace,
            issue_body_path,
            rule_map_path,
            goal_document_path=goal_document_path,
        )
        assert snapshot.design_goal is not None
        design_goal_sha256 = sha256_bytes(snapshot.design_goal)
        current: Any = None
    else:
        expected_receipt_sha256 = require_digest(
            expected_receipt_sha256,
            "expected Design completion receipt SHA-256",
        )
        snapshot = read_handoff_snapshot(
            repo_root,
            workspace,
            issue_body_path,
            rule_map_path,
            receipt_path=receipt_path,
        )
        assert snapshot.receipt is not None
        try:
            current = decode_source_json(snapshot.receipt.decode("utf-8"))
        except UnicodeDecodeError as error:
            raise ValidationError(
                "design completion receipt must be UTF-8 JSON"
            ) from error
        if sha256_bytes(snapshot.receipt) != expected_receipt_sha256:
            raise ValidationError(
                "Design completion receipt SHA-256 does not match Design completion evidence"
            )
        if not isinstance(current, dict):
            raise ValidationError("design completion receipt must be an object")
        design_goal_sha256 = require_digest(
            current.get("design_goal_sha256"),
            "design completion receipt design_goal_sha256",
        )

    validate_design_artifact(
        issue,
        issue_url,
        issue_updated_at,
        issue_body_path,
        rule_map_path,
        requirements_path,
        design_path,
        "artifact",
        repo_root,
        workspace,
        goal_document_path if capture else None,
        require_goal_document=capture,
        requirements_document_bytes=snapshot.requirements,
        design_document_bytes=snapshot.design,
        goal_document_bytes=snapshot.design_goal,
        issue_body_bytes=snapshot.issue_body,
        rule_map_bytes=snapshot.rule_map,
        requirements_baseline_bytes=snapshot.requirements_baseline,
        design_baseline_bytes=snapshot.design_baseline,
    )
    validate_display_snapshot(
        snapshot.requirements,
        snapshot.requirements_display,
        "requirements",
    )
    validate_display_snapshot(
        snapshot.design,
        snapshot.design_display,
        "design",
    )

    expected = build_receipt(
        repo_root,
        issue,
        issue_url,
        issue_updated_at,
        snapshot,
        canonical_rule_map_path,
        workspace,
        design_goal_sha256,
    )
    assert_snapshot_current(
        snapshot,
        repo_root,
        workspace,
        issue_body_path,
        canonical_rule_map_path,
        goal_document_path if capture else None,
    )
    serialized = serialize_receipt(expected)
    if capture:
        write_regular_file_atomically(receipt_path, serialized)
        if read_regular_file_bytes(receipt_path) != serialized.encode("utf-8"):
            raise ValidationError("captured Design completion receipt changed after write")
    else:
        if current != expected:
            raise ValidationError(
                "current Issue or artifacts do not match the Design completion receipt"
            )
        if snapshot.receipt != serialized.encode("utf-8"):
            raise ValidationError(
                "Design completion receipt must use canonical JSON serialization"
            )
    return receipt_path, sha256_bytes(serialized.encode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--issue", required=True)
    parser.add_argument("--issue-url", required=True)
    parser.add_argument("--issue-updated-at", required=True)
    parser.add_argument("--issue-body", required=True, type=Path)
    parser.add_argument("--rule-map", required=True, type=Path)
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--expected-receipt-sha256", required=True)
    args = parser.parse_args()

    try:
        receipt_path, receipt_sha256 = validate_or_capture(
            args.issue,
            args.issue_url,
            args.issue_updated_at,
            args.issue_body,
            args.rule_map,
            args.repo_root,
            args.workspace,
            capture=False,
            expected_receipt_sha256=args.expected_receipt_sha256,
        )
    except (
        OSError,
        UnicodeDecodeError,
        GitBaselineError,
        SourceError,
        DesignValidationError,
        ValidationError,
    ) as error:
        print(f"build entry gate: failed: {error}", file=sys.stderr)
        return 1

    print(f"build entry gate: verified: {receipt_path} sha256={receipt_sha256}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
