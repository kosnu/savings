#!/usr/bin/env python3
"""Validate full Requirements coverage for an AIDD Design Goal or Design Doc."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

from git_baseline import (
    GitBaselineError,
    load_git_head_artifact,
    validate_workspace_identity,
)
from requirement_ids import (
    extract_requirement_definitions,
    extract_level_two_sections,
    extract_requirement_mentions,
    is_requirement_id,
    normalize_markdown_text,
)

GATE_PATTERN = re.compile(
    r"(?ms)^## Design Coverage Gate\s*$.*?```json\s*\n(.*?)\n```"
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


def content_sha256(value: str) -> str:
    return hashlib.sha256(normalize_markdown_text(value).encode("utf-8")).hexdigest()


def require_complete_requirement_ids(requirements: str) -> list[str]:
    requirement_ids = extract_requirement_definitions(requirements)
    if not requirement_ids:
        raise ValidationError(
            "requirements must contain stable FR-, NFR-, or AC- identifiers"
        )
    if not any(requirement_id.startswith("FR-") for requirement_id in requirement_ids):
        raise ValidationError("requirements must contain at least one FR- identifier")
    if not any(requirement_id.startswith("AC-") for requirement_id in requirement_ids):
        raise ValidationError("requirements must contain at least one AC- identifier")
    return requirement_ids


def extract_manifest(document: str) -> tuple[dict[str, Any], str]:
    match = GATE_PATTERN.search(document)
    if match is None:
        raise ValidationError("Design Coverage Gate JSON block is missing")
    try:
        manifest = json.loads(match.group(1))
    except json.JSONDecodeError as error:
        raise ValidationError(f"Design Coverage Gate JSON is invalid: {error}") from error
    if not isinstance(manifest, dict):
        raise ValidationError("Design Coverage Gate must be a JSON object")
    document_without_gate = f"{document[:match.start()]}{document[match.end():]}"
    return manifest, document_without_gate


def validate_requirement_snapshot(
    manifest: dict[str, Any],
    requirements_bytes: bytes,
    requirement_ids: list[str],
    allowed_keys: set[str],
) -> None:
    if set(manifest) != allowed_keys:
        raise ValidationError(
            "Design Coverage Gate has invalid keys for the selected document kind"
        )

    actual_hash = hashlib.sha256(requirements_bytes).hexdigest()
    if manifest.get("requirements_sha256") != actual_hash:
        raise ValidationError(
            "requirements_sha256 does not match the supplied Requirements"
        )

    declared_ids = manifest.get("requirement_ids")
    if not isinstance(declared_ids, list) or not all(
        isinstance(requirement_id, str) for requirement_id in declared_ids
    ):
        raise ValidationError("requirement_ids must be an array of strings")
    if declared_ids != requirement_ids:
        raise ValidationError(
            "requirement_ids must exactly match all IDs in the supplied Requirements"
        )


def design_section_manifest(document: str) -> list[dict[str, str]]:
    sections = extract_level_two_sections(document)
    if not sections:
        raise ValidationError("Git HEAD Design baseline has no level-two sections")
    manifest = [
        {
            "heading": section.heading,
            "content_sha256": content_sha256(section.content),
        }
        for section in sections
    ]
    hashes = [entry["content_sha256"] for entry in manifest]
    if len(hashes) != len(set(hashes)):
        raise ValidationError("Git HEAD Design baseline has duplicate section content")
    return manifest


def validate_baseline(baseline: Any, baseline_bytes: bytes | None) -> list[dict[str, str]]:
    if not isinstance(baseline, dict) or set(baseline) != {"source", "body_sha256"}:
        raise ValidationError("baseline must contain only source and body_sha256")
    if baseline_bytes is None:
        if baseline != {"source": "none", "body_sha256": None}:
            raise ValidationError("baseline must declare none when Git HEAD has no Design Doc")
        return []

    expected_sections = design_section_manifest(baseline_bytes.decode("utf-8"))
    if baseline.get("source") != "git_head":
        raise ValidationError("baseline.source must be git_head with a Git baseline")
    if baseline.get("body_sha256") != hashlib.sha256(baseline_bytes).hexdigest():
        raise ValidationError("baseline.body_sha256 does not match Git HEAD Design Doc")
    return expected_sections


def require_unique_scope_line(
    document: str,
    required_terms: tuple[str, ...],
    label: str,
    requirement_id: str | None = None,
) -> None:
    normalized_terms = tuple(normalize(term) for term in required_terms)
    matches = [
        normalize(line)
        for line in document.splitlines()
        if all(term in normalize(line) for term in normalized_terms)
        and (
            requirement_id is None
            or requirement_id in extract_requirement_mentions(line)
        )
    ]
    if len(matches) != 1:
        raise ValidationError(f"{label} must have exactly one scope line")
    substantive = matches[0]
    for term in normalized_terms:
        substantive = substantive.replace(term, "")
    if len(substantive.strip(" :-：`*_#")) < 8:
        raise ValidationError(f"{label} scope line is not substantive")


def validate_goal_scope(
    document_without_gate: str,
    requirement_ids: list[str],
    baseline_sections: list[dict[str, str]],
) -> None:
    for requirement_id in requirement_ids:
        require_unique_scope_line(
            document_without_gate,
            (requirement_id, "design scope"),
            f"{requirement_id} design",
            requirement_id,
        )
        require_unique_scope_line(
            document_without_gate,
            (requirement_id, "verification scope"),
            f"{requirement_id} verification",
            requirement_id,
        )
    for section in baseline_sections:
        require_unique_scope_line(
            document_without_gate,
            (section["heading"], "baseline scope"),
            f"{section['heading']} baseline",
        )


def validate_requirement_evidence(
    evidence: Any,
    label: str,
    requirement_id: str,
    normalized_document: str,
) -> str:
    evidence = require_string(evidence, label)
    normalized_evidence = normalize(evidence)
    if normalized_evidence in PLACEHOLDERS:
        raise ValidationError(f"{label} is unresolved")
    if requirement_id not in extract_requirement_mentions(evidence):
        raise ValidationError(f"{label} must name {requirement_id}")
    substantive = normalized_evidence.replace(normalize(requirement_id), "").strip(" :-：`*_#")
    if len(substantive) < 8:
        raise ValidationError(f"{label} is not substantive")
    if normalized_evidence not in normalized_document:
        raise ValidationError(f"{label} is not present outside the gate")
    return normalized_evidence


def validate_per_requirement_entries(
    entries: Any,
    requirement_ids: list[str],
    document_without_gate: str,
    fields: tuple[str, str],
    label: str,
) -> None:
    if not isinstance(entries, list):
        raise ValidationError(f"{label} must be an array")

    normalized_document = normalize(document_without_gate)
    seen_ids: set[str] = set()
    seen_evidence: dict[str, set[str]] = {field: set() for field in fields}
    for index, entry in enumerate(entries):
        expected_keys = {"id", *fields}
        if not isinstance(entry, dict) or set(entry) != expected_keys:
            raise ValidationError(
                f"each {label} entry must contain only id, {fields[0]}, and {fields[1]}"
            )
        requirement_id = require_string(entry["id"], f"{label}[{index}].id")
        if not is_requirement_id(requirement_id):
            raise ValidationError(f"invalid {label} requirement ID: {requirement_id}")
        if requirement_id in seen_ids:
            raise ValidationError(f"duplicate {label} ID: {requirement_id}")
        seen_ids.add(requirement_id)

        for field in fields:
            evidence = validate_requirement_evidence(
                entry[field],
                f"{label}[{index}].{field}",
                requirement_id,
                normalized_document,
            )
            if evidence in seen_evidence[field]:
                raise ValidationError(f"duplicate {label} {field} evidence")
            seen_evidence[field].add(evidence)

    if list(entry["id"] for entry in entries) != requirement_ids:
        raise ValidationError(
            f"{label} must contain exactly one entry per Requirements ID in canonical order"
        )


def validate_artifact_coverage(
    coverage: Any,
    requirement_ids: list[str],
    document_without_gate: str,
) -> None:
    validate_per_requirement_entries(
        coverage,
        requirement_ids,
        document_without_gate,
        ("design_evidence", "verification_evidence"),
        "coverage",
    )


def validate_baseline_sections(
    transitions: Any,
    baseline_sections: list[dict[str, str]],
    document_without_gate: str,
) -> None:
    if not isinstance(transitions, list):
        raise ValidationError("baseline_sections must be an array")
    expected_identities = [
        (entry["heading"], entry["content_sha256"]) for entry in baseline_sections
    ]
    transition_identities = [
        (entry.get("heading"), entry.get("content_sha256"))
        if isinstance(entry, dict)
        else (None, None)
        for entry in transitions
    ]
    if transition_identities != expected_identities:
        raise ValidationError(
            "baseline_sections must classify every Git HEAD section in canonical order"
        )
    current_hashes = {
        content_sha256(section.content)
        for section in extract_level_two_sections(document_without_gate)
    }
    normalized_document = normalize(document_without_gate)
    seen: set[str] = set()
    seen_evidence: set[str] = set()
    for index, entry in enumerate(transitions):
        if not isinstance(entry, dict) or set(entry) != {
            "heading",
            "content_sha256",
            "status",
            "design_evidence",
        }:
            raise ValidationError(
                "each baseline_sections entry must contain only heading, "
                "content_sha256, status, and design_evidence"
            )
        heading = require_string(entry["heading"], f"baseline_sections[{index}].heading")
        section_hash = require_string(
            entry["content_sha256"],
            f"baseline_sections[{index}].content_sha256",
        )
        if section_hash in seen:
            raise ValidationError(f"duplicate baseline section: {section_hash}")
        seen.add(section_hash)
        if (heading, section_hash) not in expected_identities:
            raise ValidationError("baseline_sections contains a section outside Git HEAD")
        status = entry["status"]
        if status not in {"preserved", "replaced"}:
            raise ValidationError(f"invalid baseline section status: {status}")
        evidence = require_string(
            entry["design_evidence"],
            f"baseline_sections[{index}].design_evidence",
        )
        normalized_evidence = normalize(evidence)
        if len(normalized_evidence) < 12:
            raise ValidationError("baseline section design_evidence is not substantive")
        if normalize(heading) not in normalized_evidence:
            raise ValidationError("baseline section design_evidence must name its heading")
        if normalized_evidence in seen_evidence:
            raise ValidationError("baseline section design_evidence must be unique")
        seen_evidence.add(normalized_evidence)
        if normalized_evidence not in normalized_document:
            raise ValidationError("baseline section design_evidence is not in Design Doc")
        if status == "preserved" and section_hash not in current_hashes:
            raise ValidationError("preserved baseline section content changed")
        if status == "replaced" and section_hash in current_hashes:
            raise ValidationError("replaced baseline section is still unchanged")

def validate(
    issue: str,
    requirements_path: Path,
    document_path: Path,
    document_kind: str,
    repo_root: Path,
    workspace: str,
) -> None:
    validate_workspace_identity(repo_root, issue, workspace)
    requirements_bytes = requirements_path.read_bytes()
    requirements = requirements_bytes.decode("utf-8")
    document = document_path.read_text(encoding="utf-8")
    requirement_ids = require_complete_requirement_ids(requirements)
    manifest, document_without_gate = extract_manifest(document)
    canonical_path, baseline_bytes = load_git_head_artifact(
        repo_root,
        workspace,
        "design-doc.md",
    )
    if document_kind == "artifact" and document_path.resolve() != canonical_path.resolve():
        raise ValidationError("Design artifact must use the canonical workspace path")
    if manifest.get("workspace") != workspace:
        raise ValidationError("manifest workspace does not match --workspace")
    baseline_sections = validate_baseline(manifest.get("baseline"), baseline_bytes)

    if document_kind == "goal":
        validate_requirement_snapshot(
            manifest,
            requirements_bytes,
            requirement_ids,
            {
                "requirements_sha256",
                "workspace",
                "requirement_ids",
                "baseline",
            },
        )
        validate_goal_scope(
            document_without_gate,
            requirement_ids,
            baseline_sections,
        )
        return

    validate_requirement_snapshot(
        manifest,
        requirements_bytes,
        requirement_ids,
        {
            "requirements_sha256",
            "workspace",
            "requirement_ids",
            "baseline",
            "coverage",
            "baseline_sections",
        },
    )
    validate_artifact_coverage(
        manifest["coverage"],
        requirement_ids,
        document_without_gate,
    )
    validate_baseline_sections(
        manifest["baseline_sections"],
        baseline_sections,
        document_without_gate,
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
        UnicodeDecodeError,
        json.JSONDecodeError,
        GitBaselineError,
        ValidationError,
    ) as error:
        print(f"design coverage gate: failed: {error}", file=sys.stderr)
        return 1

    print("design coverage gate: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
