#!/usr/bin/env python3
"""Validate Design coverage from structured AIDD JSON sources."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

from artifact_source import (
    SourceError,
    is_placeholder_text,
    load_source,
    load_source_bytes,
    read_regular_file_bytes,
    structured_sha256,
)
from git_baseline import (
    GitBaselineError,
    canonical_source_path,
    load_git_head_source,
    require_canonical_worktree_path,
    validate_workspace_identity,
)
from validate_requirements_continuity import (
    ValidationError as RequirementsContinuityError,
    extract_requirement_mentions,
    validate as validate_requirements_continuity,
)
from validate_requirements_goal import (
    ValidationError as RequirementsInputError,
    validate as validate_requirements_input,
)


class ValidationError(ValueError):
    pass


SUBSTANTIVE_TEXT_MIN_LENGTH = 8


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


def requirement_ids(source: dict[str, Any]) -> list[str]:
    entries = source["validation"].get("requirements")
    if not isinstance(entries, list):
        raise ValidationError("Requirements validation.requirements must be an array")
    ids = [
        require_string(
            entry.get("id") if isinstance(entry, dict) else None,
            f"requirements[{index}].id",
        )
        for index, entry in enumerate(entries)
    ]
    if len(ids) != len(set(ids)):
        raise ValidationError("Requirements IDs must be unique")
    if not any(value.startswith("FR-") for value in ids):
        raise ValidationError("Requirements must contain at least one FR- identifier")
    if not any(value.startswith("AC-") for value in ids):
        raise ValidationError("Requirements must contain at least one AC- identifier")
    return ids


def design_sections(source: dict[str, Any]) -> list[dict[str, Any]]:
    """Return the saved structured section inventory."""

    entries = source["validation"].get("sections")
    if not isinstance(entries, list) or not entries:
        raise ValidationError("Design source has no structured sections")
    sections: list[dict[str, Any]] = []
    headings: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ValidationError(f"sections[{index}] must be an object")
        heading = require_string(entry.get("heading"), f"sections[{index}].heading")
        if heading in headings:
            raise ValidationError(f"duplicate Design section heading: {heading}")
        digest = structured_sha256(entry)
        section_id = require_string(entry.get("id"), f"sections[{index}].id")
        headings.add(heading)
        sections.append(
            {
                "section_id": section_id,
                "heading": heading,
                "content_sha256": digest,
            }
        )
    return sections


def evidence_blocks(source: dict[str, Any]) -> dict[str, dict[str, Any]]:
    blocks: dict[str, dict[str, Any]] = {}
    for section in source["validation"].get("sections", []):
        if not isinstance(section, dict):
            continue
        for block in section.get("blocks", []):
            if isinstance(block, dict) and block.get("type") == "evidence":
                block_id = require_string(block.get("id"), "evidence block id")
                if block_id in blocks:
                    raise ValidationError(f"duplicate evidence block ID: {block_id}")
                blocks[block_id] = block
    return blocks


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
) -> list[dict[str, Any]]:
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
    try:
        baseline_source = load_source_bytes(baseline_bytes, "design")
    except SourceError as error:
        raise ValidationError(f"invalid Git HEAD Design JSON: {error}") from error
    return design_sections(baseline_source)


def require_substantive_text(
    value: Any,
    label: str,
    *metadata: str,
) -> str:
    text = require_string(value, label)
    if is_placeholder_text(text):
        raise ValidationError(f"{label} is unresolved")
    substantive = normalize(text)
    for term in metadata:
        substantive = substantive.replace(normalize(term), "")
    substantive = re.sub(r"[\W_]+", "", substantive)
    if len(substantive) < SUBSTANTIVE_TEXT_MIN_LENGTH:
        raise ValidationError(f"{label} is not substantive")
    return text


def reject_other_requirement_ids(
    text: str,
    label: str,
    requirement_id: str,
) -> None:
    other_ids = [
        mentioned_id
        for mentioned_id in extract_requirement_mentions(text)
        if mentioned_id != requirement_id
    ]
    if other_ids:
        raise ValidationError(
            f"{label} must not name requirement IDs other than {requirement_id}: "
            f"{', '.join(other_ids)}"
        )


def names_other_baseline_heading(
    value: str,
    target_heading: str,
    baseline_headings: list[str],
) -> bool:
    normalized_value = normalize(value)
    normalized_target = normalize(target_heading)
    value_without_target = normalized_value.replace(normalized_target, "", 1)
    return any(
        other != target_heading
        and (
            normalize(other) in value_without_target
            or (
                len(normalize(other)) > len(normalized_target)
                and normalize(other) in normalized_value
            )
        )
        for other in baseline_headings
    )


def validate_scopes(entries: Any, ids: list[str]) -> None:
    if not isinstance(entries, list):
        raise ValidationError("validation.scopes must be an array")
    if [entry.get("id") if isinstance(entry, dict) else None for entry in entries] != ids:
        raise ValidationError("scopes must contain every Requirements ID in order")
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != {
            "id", "design_scope", "verification_scope"
        }:
            raise ValidationError(
                "each scope must contain only id, design_scope, and verification_scope"
            )
        design = require_substantive_text(
            entry["design_scope"],
            f"scopes[{index}].design_scope",
            entry["id"],
            "design scope",
        )
        verification = require_substantive_text(
            entry["verification_scope"],
            f"scopes[{index}].verification_scope",
            entry["id"],
            "verification scope",
        )
        reject_other_requirement_ids(
            design,
            f"scopes[{index}].design_scope",
            entry["id"],
        )
        reject_other_requirement_ids(
            verification,
            f"scopes[{index}].verification_scope",
            entry["id"],
        )
        if normalize(design) == normalize(verification):
            raise ValidationError(
                f"scopes[{index}] design and verification scopes must differ"
            )


def validate_baseline_scopes(
    entries: Any,
    baseline_sections: list[dict[str, Any]],
) -> None:
    if not isinstance(entries, list):
        raise ValidationError("validation.baseline_scopes must be an array")
    expected_sections = [
        (entry["section_id"], entry["heading"]) for entry in baseline_sections
    ]
    actual_sections = [
        (entry.get("section_id"), entry.get("heading"))
        if isinstance(entry, dict)
        else (None, None)
        for entry in entries
    ]
    if actual_sections != expected_sections:
        raise ValidationError(
            "baseline_scopes must cover every Git HEAD section in order"
        )
    baseline_headings = [entry["heading"] for entry in baseline_sections]
    seen_scopes: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != {
            "section_id",
            "heading",
            "review_scope",
        }:
            raise ValidationError(
                "each baseline scope must contain section_id, heading, and review_scope"
            )
        scope = require_substantive_text(
            entry["review_scope"],
            f"baseline_scopes[{index}].review_scope",
            entry["section_id"] or "",
            entry["heading"],
            "baseline scope",
        )
        if normalize(entry["heading"]) not in normalize(scope):
            raise ValidationError("baseline review scope must name its heading")
        if names_other_baseline_heading(
            scope,
            entry["heading"],
            baseline_headings,
        ):
            raise ValidationError(
                "baseline review scope must name only its target heading"
            )
        normalized_scope = normalize(scope)
        if normalized_scope in seen_scopes:
            raise ValidationError("baseline review scopes must be unique")
        seen_scopes.add(normalized_scope)


def require_evidence_reference(
    block_id: Any,
    label: str,
    blocks: dict[str, dict[str, Any]],
    *,
    expected_role: str,
    expected_owner: str,
) -> str:
    reference = require_string(block_id, label)
    block = blocks.get(reference)
    if block is None:
        raise ValidationError(f"{label} must reference an evidence block")
    if block.get("role") != expected_role:
        raise ValidationError(f"{label} must reference {expected_role} evidence")
    if block.get("owner_id") != expected_owner:
        raise ValidationError(f"{label} evidence owner must be {expected_owner}")
    require_substantive_text(
        block.get("text"),
        f"{label} evidence text",
        expected_owner,
    )
    if expected_role in {"design", "verification"}:
        reject_other_requirement_ids(
            block["text"],
            f"{label} evidence text",
            expected_owner,
        )
    return reference


def validate_coverage(
    entries: Any,
    ids: list[str],
    blocks: dict[str, dict[str, Any]],
) -> None:
    if not isinstance(entries, list):
        raise ValidationError("coverage must be an array")
    if [entry.get("id") if isinstance(entry, dict) else None for entry in entries] != ids:
        raise ValidationError("coverage must contain every Requirements ID in order")
    references: list[str] = []
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != {
            "id", "design_block_id", "verification_block_id"
        }:
            raise ValidationError(
                "each coverage entry must contain only id and both evidence block IDs"
            )
        design_reference = require_evidence_reference(
            entry["design_block_id"],
            f"coverage[{index}].design_block_id",
            blocks,
            expected_role="design",
            expected_owner=entry["id"],
        )
        verification_reference = require_evidence_reference(
            entry["verification_block_id"],
            f"coverage[{index}].verification_block_id",
            blocks,
            expected_role="verification",
            expected_owner=entry["id"],
        )
        if design_reference == verification_reference:
            raise ValidationError(
                f"coverage[{index}] design and verification block IDs must differ"
            )
        if normalize(blocks[design_reference]["text"]) == normalize(
            blocks[verification_reference]["text"]
        ):
            raise ValidationError(
                f"coverage[{index}] design and verification evidence text must differ"
            )
        references.extend((design_reference, verification_reference))
    if len(references) != len(set(references)):
        raise ValidationError("coverage evidence block references must be unique")


def validate_baseline_sections(
    transitions: Any,
    baseline_sections: list[dict[str, Any]],
    current_sections: list[dict[str, Any]],
    blocks: dict[str, dict[str, Any]],
) -> None:
    if not isinstance(transitions, list):
        raise ValidationError("baseline_sections must be an array")
    expected = [
        (entry["section_id"], entry["heading"], entry["content_sha256"])
        for entry in baseline_sections
    ]
    actual = [
        (entry.get("section_id"), entry.get("heading"), entry.get("content_sha256"))
        if isinstance(entry, dict) else (None, None, None)
        for entry in transitions
    ]
    if actual != expected:
        raise ValidationError("baseline_sections must classify every Git HEAD section")
    current_by_id = {
        entry["section_id"]: entry
        for entry in current_sections
        if entry["section_id"] is not None
    }
    current_by_heading = {entry["heading"]: entry for entry in current_sections}
    baseline_headings = [entry["heading"] for entry in baseline_sections]
    references: list[str] = []
    for index, entry in enumerate(transitions):
        if not isinstance(entry, dict):
            raise ValidationError("invalid baseline_sections entry")
        status = entry.get("status")
        if status not in ("preserved", "replaced"):
            raise ValidationError(f"invalid baseline section status: {status}")
        expected_keys = {"section_id", "heading", "content_sha256", "status"}
        if status == "replaced":
            expected_keys.add("design_block_id")
        if set(entry) != expected_keys:
            raise ValidationError("invalid baseline_sections entry")
        section_id = entry["section_id"]
        if status == "replaced":
            expected_owner = section_id if section_id is not None else entry["heading"]
            reference = require_evidence_reference(
                entry["design_block_id"],
                f"baseline_sections[{index}].design_block_id",
                blocks,
                expected_role="baseline",
                expected_owner=expected_owner,
            )
            evidence_text = blocks[reference]["text"]
            if normalize(entry["heading"]) not in normalize(evidence_text):
                raise ValidationError("baseline evidence must name its heading")
            if names_other_baseline_heading(
                evidence_text,
                entry["heading"],
                baseline_headings,
            ):
                raise ValidationError(
                    "baseline evidence must name only its target heading"
                )
            references.append(reference)
        section_hash = entry["content_sha256"]
        current = (
            current_by_id.get(section_id)
            if section_id is not None
            else current_by_heading.get(entry["heading"])
        )
        unchanged = current is not None and current["content_sha256"] == section_hash
        if status == "preserved" and not unchanged:
            raise ValidationError("preserved baseline section changed")
        if status == "replaced" and unchanged:
            raise ValidationError("replaced baseline section is unchanged")
    if len(references) != len(set(references)):
        raise ValidationError("baseline evidence block references must be unique")


def validate(
    issue: str,
    issue_url: str,
    issue_updated_at: str,
    issue_body_path: Path,
    rule_map_path: Path,
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
    requirements_bytes = read_regular_file_bytes(requirements_path)
    try:
        requirements_source = load_source_bytes(requirements_bytes, "requirements")
    except SourceError as error:
        raise ValidationError(
            f"Requirements artifact gate revalidation failed: {error}"
        ) from error
    if requirements_source["workspace"] != workspace:
        raise ValidationError("Requirements source workspace does not match")
    if requirements_source["validation"].get("mode") != "managed":
        raise ValidationError("normal validation requires validation.mode=managed")
    issue_body_bytes = read_regular_file_bytes(issue_body_path)
    canonical_rule_map_path = require_canonical_input(
        repo_root, rule_map_path, Path("docs/harness/rule-map.json"), "rule-map"
    )
    rule_map_bytes = read_regular_file_bytes(canonical_rule_map_path)
    try:
        validate_requirements_input(
            issue_body_path,
            requirements_path,
            rule_map_path,
            issue,
            issue_url,
            issue_updated_at,
            "artifact",
            repo_root,
            require_goal_document=False,
            document_bytes=requirements_bytes,
            issue_body_bytes=issue_body_bytes,
            rule_map_bytes=rule_map_bytes,
        )
        validate_requirements_continuity(
            issue,
            issue_body_path,
            requirements_path,
            "artifact",
            repo_root,
            workspace,
            require_goal_document=False,
            document_bytes=requirements_bytes,
            issue_body_bytes=issue_body_bytes,
        )
    except (RequirementsInputError, RequirementsContinuityError) as error:
        raise ValidationError(
            f"Requirements artifact gate revalidation failed: {error}"
        ) from error
    ids = requirement_ids(requirements_source)

    try:
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
    except SourceError as error:
        raise ValidationError(f"Design source validation failed: {error}") from error
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
        validate_baseline_scopes(
            source["validation"].get("baseline_scopes"), baseline_sections
        )
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
    current_sections = design_sections(source)
    blocks = evidence_blocks(source)
    validate_coverage(manifest.get("coverage"), ids, blocks)
    validate_baseline_sections(
        manifest.get("baseline_sections"), baseline_sections, current_sections, blocks
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--issue", required=True)
    parser.add_argument("--issue-url", required=True)
    parser.add_argument("--issue-updated-at", required=True)
    parser.add_argument("--issue-body", required=True, type=Path)
    parser.add_argument("--rule-map", required=True, type=Path)
    parser.add_argument("--requirements", required=True, type=Path)
    parser.add_argument("--document", required=True, type=Path)
    parser.add_argument("--kind", required=True, choices=("goal", "artifact"))
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--workspace", required=True)
    args = parser.parse_args()
    try:
        validate(
            args.issue,
            args.issue_url,
            args.issue_updated_at,
            args.issue_body,
            args.rule_map,
            args.requirements,
            args.document,
            args.kind,
            args.repo_root,
            args.workspace,
        )
    except (
        OSError,
        UnicodeDecodeError,
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
