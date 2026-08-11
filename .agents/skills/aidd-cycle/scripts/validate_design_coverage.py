#!/usr/bin/env python3
"""Validate Design coverage from structured AIDD JSON sources."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

from artifact_source import SourceError, load_source, load_source_bytes
from git_baseline import (
    GitBaselineError,
    canonical_source_path,
    load_git_head_source,
    require_canonical_worktree_path,
    validate_workspace_identity,
)
from structured_ids import (
    extract_requirement_mentions,
    is_requirement_id,
    normalize_structured_text,
    requirement_sort_key,
)


PLACEHOLDERS = {"pending", "tbd", "todo", "未定"}


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
            repo_root,
            supplied_path,
            relative_path,
            label,
        )
    except GitBaselineError as error:
        raise ValidationError(str(error)) from error


def content_sha256(value: str) -> str:
    return hashlib.sha256(normalize_structured_text(value).encode("utf-8")).hexdigest()


def requirement_ids(source: dict[str, Any]) -> list[str]:
    entries = source["validation"].get("requirements")
    if not isinstance(entries, list):
        raise ValidationError("Requirements validation.requirements must be an array")
    ids: list[str] = []
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != {"id", "content"}:
            raise ValidationError(
                "each Requirements entry must contain only id and content"
            )
        requirement_id = require_string(entry["id"], f"requirements[{index}].id")
        require_string(entry["content"], f"requirements[{index}].content")
        if not is_requirement_id(requirement_id):
            raise ValidationError(f"invalid requirement ID: {requirement_id}")
        ids.append(requirement_id)
    if ids != sorted(set(ids), key=requirement_sort_key):
        raise ValidationError("Requirements IDs must be unique and use canonical order")
    if not any(value.startswith("FR-") for value in ids):
        raise ValidationError("Requirements must contain at least one FR- identifier")
    if not any(value.startswith("AC-") for value in ids):
        raise ValidationError("Requirements must contain at least one AC- identifier")
    return ids


def design_sections(source: dict[str, Any]) -> list[dict[str, str]]:
    entries = source["validation"].get("sections")
    if not isinstance(entries, list):
        raise ValidationError("Design validation.sections must be an array")
    sections: list[dict[str, str]] = []
    headings: set[str] = set()
    hashes: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != {"heading", "content"}:
            raise ValidationError(
                "each Design section must contain only heading and content"
            )
        heading = require_string(entry["heading"], f"sections[{index}].heading")
        content = require_string(entry["content"], f"sections[{index}].content")
        section_hash = content_sha256(content)
        if heading in headings:
            raise ValidationError(f"duplicate Design section heading: {heading}")
        if section_hash in hashes:
            raise ValidationError("duplicate Design section content")
        headings.add(heading)
        hashes.add(section_hash)
        sections.append({"heading": heading, "content_sha256": section_hash})
    if not sections:
        raise ValidationError("Design source has no structured sections")
    return sections


def extract_manifest(source: dict[str, Any]) -> dict[str, Any]:
    manifest = source["validation"].get("coverage_gate")
    if not isinstance(manifest, dict):
        raise ValidationError("validation.coverage_gate must be an object")
    return manifest


def validate_snapshot(
    manifest: dict[str, Any],
    requirements_bytes: bytes,
    ids: list[str],
    allowed_keys: set[str],
) -> None:
    if set(manifest) != allowed_keys:
        raise ValidationError("Design Coverage Gate has invalid keys")
    if manifest.get("requirements_sha256") != hashlib.sha256(
        requirements_bytes
    ).hexdigest():
        raise ValidationError("requirements_sha256 does not match Requirements JSON")
    if manifest.get("requirement_ids") != ids:
        raise ValidationError("requirement_ids must exactly match Requirements JSON")


def validate_baseline(
    baseline: Any,
    baseline_bytes: bytes | None,
) -> list[dict[str, str]]:
    if not isinstance(baseline, dict) or set(baseline) != {"source", "body_sha256"}:
        raise ValidationError("baseline must contain only source and body_sha256")
    if baseline_bytes is None:
        if baseline != {"source": "none", "body_sha256": None}:
            raise ValidationError("baseline must declare none without Design JSON")
        return []
    if baseline.get("source") != "git_head":
        raise ValidationError("baseline.source must be git_head")
    if baseline.get("body_sha256") != hashlib.sha256(baseline_bytes).hexdigest():
        raise ValidationError("baseline.body_sha256 does not match Git HEAD Design JSON")
    return design_sections(load_source_bytes(baseline_bytes, "design"))


def validate_id_text(value: Any, label: str, requirement_id: str) -> str:
    text = require_string(value, label)
    if normalize(text) in PLACEHOLDERS:
        raise ValidationError(f"{label} is unresolved")
    if extract_requirement_mentions(text) != [requirement_id]:
        raise ValidationError(f"{label} must name only {requirement_id}")
    substantive = normalize(text).replace(normalize(requirement_id), "").strip(" :-：`*_#")
    if len(substantive) < 8:
        raise ValidationError(f"{label} is not substantive")
    return text


def validate_scopes(entries: Any, ids: list[str]) -> None:
    if not isinstance(entries, list):
        raise ValidationError("validation.scopes must be an array")
    if [entry.get("id") if isinstance(entry, dict) else None for entry in entries] != ids:
        raise ValidationError("scopes must contain every Requirements ID in order")
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != {
            "id",
            "design_scope",
            "verification_scope",
        }:
            raise ValidationError(
                "each scope must contain only id, design_scope, and verification_scope"
            )
        requirement_id = entry["id"]
        validate_id_text(entry["design_scope"], f"scopes[{index}].design_scope", requirement_id)
        validate_id_text(
            entry["verification_scope"],
            f"scopes[{index}].verification_scope",
            requirement_id,
        )


def validate_coverage(entries: Any, ids: list[str]) -> None:
    if not isinstance(entries, list):
        raise ValidationError("coverage must be an array")
    if [entry.get("id") if isinstance(entry, dict) else None for entry in entries] != ids:
        raise ValidationError("coverage must contain every Requirements ID in order")
    seen_design: set[str] = set()
    seen_verification: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != {
            "id",
            "design_evidence",
            "verification_evidence",
        }:
            raise ValidationError(
                "each coverage entry must contain only id and both evidence fields"
            )
        requirement_id = entry["id"]
        design = validate_id_text(
            entry["design_evidence"],
            f"coverage[{index}].design_evidence",
            requirement_id,
        )
        verification = validate_id_text(
            entry["verification_evidence"],
            f"coverage[{index}].verification_evidence",
            requirement_id,
        )
        if design in seen_design or verification in seen_verification:
            raise ValidationError("coverage evidence must be unique")
        seen_design.add(design)
        seen_verification.add(verification)


def validate_baseline_sections(
    transitions: Any,
    baseline_sections: list[dict[str, str]],
    current_sections: list[dict[str, str]],
) -> None:
    if not isinstance(transitions, list):
        raise ValidationError("baseline_sections must be an array")
    expected = [
        (entry["heading"], entry["content_sha256"]) for entry in baseline_sections
    ]
    actual = [
        (entry.get("heading"), entry.get("content_sha256"))
        if isinstance(entry, dict)
        else (None, None)
        for entry in transitions
    ]
    if actual != expected:
        raise ValidationError("baseline_sections must classify every Git HEAD section")
    current_hashes = {entry["content_sha256"] for entry in current_sections}
    baseline_headings = [entry["heading"] for entry in baseline_sections]
    for index, entry in enumerate(transitions):
        if not isinstance(entry, dict) or set(entry) != {
            "heading",
            "content_sha256",
            "status",
            "design_evidence",
        }:
            raise ValidationError("invalid baseline_sections entry")
        heading = entry["heading"]
        status = entry["status"]
        evidence = require_string(
            entry["design_evidence"],
            f"baseline_sections[{index}].design_evidence",
        )
        if normalize(heading) not in normalize(evidence):
            raise ValidationError("baseline evidence must name its heading")
        if any(
            other != heading and normalize(other) in normalize(evidence)
            for other in baseline_headings
        ):
            raise ValidationError("baseline evidence must name only its target heading")
        section_hash = entry["content_sha256"]
        if status == "preserved" and section_hash not in current_hashes:
            raise ValidationError("preserved baseline section changed")
        if status == "replaced" and section_hash in current_hashes:
            raise ValidationError("replaced baseline section is unchanged")
        if status not in {"preserved", "replaced"}:
            raise ValidationError(f"invalid baseline section status: {status}")


def validate(
    issue: str,
    requirements_path: Path,
    document_path: Path,
    document_kind: str,
    repo_root: Path,
    workspace: str,
) -> None:
    validate_workspace_identity(repo_root, issue, workspace)
    require_canonical_input(
        repo_root,
        requirements_path,
        canonical_source_path(Path(), workspace, "requirements"),
        "Design coverage Requirements source",
    )
    requirements_bytes = requirements_path.read_bytes()
    requirements_source = load_source(requirements_path, "requirements")
    if requirements_source["workspace"] != workspace:
        raise ValidationError("Requirements source workspace does not match")
    if requirements_source["validation"].get("mode") != "managed":
        raise ValidationError("normal validation requires validation.mode=managed")
    ids = requirement_ids(requirements_source)

    if document_kind == "artifact":
        require_canonical_input(
            repo_root,
            document_path,
            canonical_source_path(Path(), workspace, "design"),
            "Design source",
        )
        source = load_source(document_path, "design")
    elif document_kind == "goal":
        source = load_source(document_path, "design_goal")
    else:
        raise ValidationError("document kind must be goal or artifact")
    if source["workspace"] != workspace:
        raise ValidationError("Design source workspace does not match")
    if source["validation"].get("mode") != "managed":
        raise ValidationError("normal validation requires validation.mode=managed")
    manifest = extract_manifest(source)
    if manifest.get("workspace") != workspace:
        raise ValidationError("manifest workspace does not match")
    _, baseline_bytes = load_git_head_source(repo_root, workspace, "design")
    baseline_sections = validate_baseline(manifest.get("baseline"), baseline_bytes)

    if document_kind == "goal":
        validate_snapshot(
            manifest,
            requirements_bytes,
            ids,
            {"requirements_sha256", "workspace", "requirement_ids", "baseline"},
        )
        validate_scopes(source["validation"].get("scopes"), ids)
        return

    validate_snapshot(
        manifest,
        requirements_bytes,
        ids,
        {
            "requirements_sha256",
            "workspace",
            "requirement_ids",
            "baseline",
            "coverage",
            "baseline_sections",
        },
    )
    validate_coverage(manifest.get("coverage"), ids)
    validate_baseline_sections(
        manifest.get("baseline_sections"),
        baseline_sections,
        design_sections(source),
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--issue", required=True)
    parser.add_argument("--requirements", required=True, type=Path)
    parser.add_argument("--document", required=True, type=Path)
    parser.add_argument("--kind", required=True, choices=("goal", "artifact"))
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--workspace", required=True)
    args = parser.parse_args()
    try:
        validate(
            args.issue,
            args.requirements,
            args.document,
            args.kind,
            args.repo_root,
            args.workspace,
        )
    except (
        OSError,
        json.JSONDecodeError,
        GitBaselineError,
        SourceError,
        ValidationError,
    ) as error:
        print(f"design coverage gate: failed: {error}", file=sys.stderr)
        return 1
    print("design coverage gate: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
