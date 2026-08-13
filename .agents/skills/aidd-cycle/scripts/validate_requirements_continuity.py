#!/usr/bin/env python3
"""Validate complete replacement continuity for AIDD Requirements artifacts."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass
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
    REQUIRED_REQUIREMENTS_SECTIONS,
    extract_requirement_mentions,
    is_requirement_id,
    normalize_structured_text,
    requirement_section_ids_for_heading,
    requirement_sort_key,
)


class ValidationError(ValueError):
    pass


@dataclass(frozen=True)
class StructuredContent:
    content: str


REQUIREMENT_CONTENT_PLACEHOLDER_PATTERN = re.compile(
    r"\b(?:pending|tbd|todo)\b|未定",
    re.IGNORECASE,
)
REQUIREMENT_CONTENT_PLACEHOLDER_ONLY_PATTERN = re.compile(
    r"(?:(?:pending|tbd|todo|未定)\s*"
    r"(?:(?:です|である|対応待ち|待ち)\s*)*"
    r"[\s:：,，、.。;；*`_#-]*)+",
    re.IGNORECASE,
)


RETIREMENT_TERMS = {
    "対象外",
    "廃止",
    "削除",
    "撤回",
    "不要",
    "out of scope",
    "remove",
    "removed",
    "retire",
    "retired",
    "drop",
    "dropped",
    "deprecate",
    "deprecated",
}

NEGATED_RETIREMENT_PATTERNS = (
    re.compile(
        r"(?:対象外|廃止|削除|撤回|不要)(?:に|と|を)?(?:は)?"
        r"(?:しない|しません|されない|されません|する必要はない|"
        r"する必要がない|する必要はありません|の必要はない|"
        r"することはない|されることはない|"
        r"ではない|でない|は不要)"
    ),
    re.compile(
        r"(?:対象外|廃止|削除|撤回|不要)"
        r"(?:(?:に|と)?(?:する|される)?こと)?(?:に|と|を|は)?"
        r"禁止(?:する|します|される|されます|されている|されています|"
        r"とする|とされる|だ|です)?(?=[\s。．、,;；]|$)"
    ),
    re.compile(
        r"\b(?:do|does|must|should|shall|will|can)\s+not\s+"
        r"(?:remove|retire|drop|deprecate)\b"
    ),
    re.compile(r"\bnever\s+(?:remove|retire|drop|deprecate)\b"),
    re.compile(
        r"\b(?:don't|doesn't|mustn't|shouldn't|won't|can't)\s+"
        r"(?:be\s+)?(?:remove|removed|retire|retired|drop|dropped|"
        r"deprecate|deprecated)\b"
    ),
    re.compile(r"\bnot\s+(?:be\s+)?(?:removed|retired|dropped|deprecated)\b"),
    re.compile(r"\bnot\s+(?:be\s+|considered\s+)?out\s+of\s+scope\b"),
    re.compile(r"\b(?:isn't|aren't)\s+out\s+of\s+scope\b"),
    re.compile(
        r"\b(?:removal|retirement|dropping|deprecation)\s+"
        r"(?:is\s+)?not\s+(?:required|needed)\b"
    ),
)


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


def extract_manifest(source: dict[str, Any]) -> dict[str, Any]:
    manifest = source["validation"].get("completeness_gate")
    if not isinstance(manifest, dict):
        raise ValidationError("validation.completeness_gate must be an object")
    if set(manifest) != {
        "issue_body_sha256",
        "workspace",
        "baseline",
        "requirements",
        "sections",
        "retired",
    }:
        raise ValidationError(
            "Requirements Completeness Gate must contain only issue_body_sha256, "
            "workspace, baseline, requirements, sections, and retired"
        )
    return manifest


def content_sha256(value: str) -> str:
    return hashlib.sha256(normalize_structured_text(value).encode("utf-8")).hexdigest()


def require_substantive_requirement_content(
    requirement_id: str,
    content: str,
) -> None:
    content_without_id = normalize(content).replace(normalize(requirement_id), "")
    content_without_id = content_without_id.strip(" :-：,，、.。;；`*_#")
    if REQUIREMENT_CONTENT_PLACEHOLDER_ONLY_PATTERN.fullmatch(content_without_id):
        raise ValidationError(
            "requirement content must have a substantive summary: "
            f"{requirement_id}"
        )
    substantive = content_without_id
    substantive = REQUIREMENT_CONTENT_PLACEHOLDER_PATTERN.sub("", substantive)
    substantive = re.sub(r"[\W_]+", "", substantive)
    if len(substantive) < 2:
        raise ValidationError(
            "requirement content must have a substantive summary: "
            f"{requirement_id}"
        )


def structured_requirements(source: dict[str, Any]) -> dict[str, StructuredContent]:
    entries = source["validation"].get("requirements")
    if not isinstance(entries, list):
        raise ValidationError("validation.requirements must be an array")
    items: dict[str, StructuredContent] = {}
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != {"id", "content"}:
            raise ValidationError(
                "each validation.requirements entry must contain only id and content"
            )
        requirement_id = require_string(entry["id"], f"requirements[{index}].id")
        content = require_string(entry["content"], f"requirements[{index}].content")
        if not is_requirement_id(requirement_id):
            raise ValidationError(f"invalid structured requirement ID: {requirement_id}")
        require_substantive_requirement_content(requirement_id, content)
        if requirement_id in items:
            raise ValidationError(f"duplicate structured requirement: {requirement_id}")
        items[requirement_id] = StructuredContent(content)
    if list(items) != sorted(items, key=requirement_sort_key):
        raise ValidationError("structured requirements must use canonical ID order")
    return items


def structured_sections(source: dict[str, Any]) -> dict[str, StructuredContent]:
    entries = source["validation"].get("sections")
    if not isinstance(entries, list):
        raise ValidationError("validation.sections must be an array")
    sections: dict[str, StructuredContent] = {}
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != {"id", "heading", "content"}:
            raise ValidationError(
                "each validation.sections entry must contain only id, heading, and content"
            )
        section_id = require_string(entry["id"], f"sections[{index}].id")
        heading = require_string(entry["heading"], f"sections[{index}].heading")
        if requirement_section_ids_for_heading(heading) != (section_id,):
            raise ValidationError(
                f"section {section_id} heading does not match its canonical aliases"
            )
        content = require_string(entry["content"], f"sections[{index}].content")
        if section_id in sections:
            raise ValidationError(f"duplicate structured section: {section_id}")
        sections[section_id] = StructuredContent(content)
    expected_order = [
        section_id for section_id in REQUIRED_REQUIREMENTS_SECTIONS if section_id in sections
    ]
    if list(sections) != expected_order:
        raise ValidationError("structured sections must use canonical section order")
    return sections


def baseline_item_manifest(baseline_bytes: bytes) -> list[dict[str, str]]:
    items = structured_requirements(load_source_bytes(baseline_bytes, "requirements"))
    if not items:
        raise ValidationError(
            "Git HEAD Requirements baseline has no stable requirement definitions"
        )
    return [
        {"id": requirement_id, "content_sha256": content_sha256(items[requirement_id].content)}
        for requirement_id in sorted(items, key=requirement_sort_key)
    ]


def baseline_section_manifest(baseline_bytes: bytes) -> list[dict[str, str]]:
    sections = structured_sections(load_source_bytes(baseline_bytes, "requirements"))
    return [
        {"id": section_id, "content_sha256": content_sha256(sections[section_id].content)}
        for section_id in REQUIRED_REQUIREMENTS_SECTIONS
        if section_id in sections
    ]


def validate_baseline(
    baseline: Any,
    baseline_bytes: bytes | None,
) -> dict[str, dict[str, str]]:
    if not isinstance(baseline, dict) or set(baseline) != {
        "source",
        "body_sha256",
    }:
        raise ValidationError(
            "baseline must contain only source and body_sha256"
        )

    source = baseline.get("source")
    if baseline_bytes is None:
        if source != "none":
            raise ValidationError("baseline.source must be none without a baseline file")
        if baseline.get("body_sha256") is not None:
            raise ValidationError("baseline.body_sha256 must be null without a baseline")
        return {"requirements": {}, "sections": {}}

    if source != "git_head":
        raise ValidationError("baseline.source must be git_head with a Git baseline")
    expected_items = baseline_item_manifest(baseline_bytes)
    expected_sections = baseline_section_manifest(baseline_bytes)
    if baseline.get("body_sha256") != hashlib.sha256(baseline_bytes).hexdigest():
        raise ValidationError("baseline.body_sha256 does not match Git HEAD Requirements")
    return {
        "requirements": {
            entry["id"]: entry["content_sha256"] for entry in expected_items
        },
        "sections": {
            entry["id"]: entry["content_sha256"] for entry in expected_sections
        },
    }


def validate_sections_manifest(
    sections: Any,
    baseline_sections: dict[str, str],
    issue_body: str,
    current_sections: dict[str, Any] | None,
) -> dict[str, str]:
    if not isinstance(sections, list):
        raise ValidationError("sections must be an array")
    expected_ids = list(REQUIRED_REQUIREMENTS_SECTIONS)
    if [entry.get("id") if isinstance(entry, dict) else None for entry in sections] != expected_ids:
        raise ValidationError(
            "sections must contain every canonical Requirements section in order"
        )

    statuses: dict[str, str] = {}
    evidence_owners: dict[str, str] = {}
    for index, entry in enumerate(sections):
        if not isinstance(entry, dict) or set(entry) != {
            "id",
            "status",
            "issue_evidence",
        }:
            raise ValidationError(
                "each sections entry must contain only id, status, and issue_evidence"
            )
        section_id = entry["id"]
        status = require_string(entry["status"], f"sections[{index}].status")
        if status not in {"unchanged", "changed", "new"}:
            raise ValidationError(f"invalid Requirements section status: {status}")
        if status in {"unchanged", "changed"} and section_id not in baseline_sections:
            raise ValidationError(f"{status} section is not in Git HEAD: {section_id}")
        if status == "new" and section_id in baseline_sections:
            raise ValidationError(f"new section already exists in Git HEAD: {section_id}")

        evidence = entry["issue_evidence"]
        if status == "unchanged":
            if evidence is not None:
                raise ValidationError(
                    f"unchanged section must use null issue_evidence: {section_id}"
                )
        else:
            evidence = require_string(evidence, f"sections[{index}].issue_evidence")
            if normalize(evidence) not in normalize(issue_body):
                raise ValidationError(
                    f"{section_id} section evidence is not in the current Issue"
                )
            if current_sections is not None:
                normalized_evidence = normalize(evidence)
                if normalized_evidence in evidence_owners:
                    raise ValidationError(
                        "changed or new section issue_evidence must be unique per section"
                    )
                evidence_owners[normalized_evidence] = section_id
                if normalized_evidence not in normalize(
                    current_sections[section_id].content
                ):
                    raise ValidationError(
                        f"{section_id} section evidence is not present in its section content"
                    )
                if any(
                    normalized_evidence in normalize(other_section.content)
                    for other_id, other_section in current_sections.items()
                    if other_id != section_id
                ):
                    raise ValidationError(
                        f"{section_id} section evidence also maps to another section"
                    )
        statuses[section_id] = status
    return statuses


def validate_requirements_manifest(
    requirements: Any,
    baseline_items: dict[str, str],
    issue_body: str,
    current_items: dict[str, Any],
) -> dict[str, str]:
    if not isinstance(requirements, list):
        raise ValidationError("requirements must be an array")

    statuses: dict[str, str] = {}
    evidence_owners: dict[str, str] = {}
    for index, entry in enumerate(requirements):
        if not isinstance(entry, dict) or set(entry) != {
            "id",
            "status",
            "issue_evidence",
        }:
            raise ValidationError(
                "each requirements entry must contain only id, status, and issue_evidence"
            )
        requirement_id = require_string(entry["id"], f"requirements[{index}].id")
        if not is_requirement_id(requirement_id):
            raise ValidationError(f"invalid requirement ID: {requirement_id}")
        if requirement_id in statuses:
            raise ValidationError(f"duplicate requirements ID: {requirement_id}")

        status = require_string(entry["status"], f"requirements[{index}].status")
        if status not in {"unchanged", "changed", "new"}:
            raise ValidationError(f"invalid requirement status: {status}")
        if status in {"unchanged", "changed"} and requirement_id not in baseline_items:
            raise ValidationError(
                f"{status} requirement is not in Git HEAD: {requirement_id}"
            )
        if status == "new" and requirement_id in baseline_items:
            raise ValidationError(f"new requirement already exists in Git HEAD: {requirement_id}")

        evidence = entry["issue_evidence"]
        if status == "unchanged":
            if evidence is not None:
                raise ValidationError(
                    f"unchanged requirement must use null issue_evidence: {requirement_id}"
                )
        else:
            evidence = require_string(
                evidence,
                f"requirements[{index}].issue_evidence",
            )
            if normalize(evidence) not in normalize(issue_body):
                raise ValidationError(
                    f"{requirement_id} issue_evidence is not present in the current Issue"
                )
            normalized_evidence = normalize(evidence)
            if normalized_evidence in evidence_owners:
                raise ValidationError(
                    "changed or new requirement issue_evidence must be unique per requirement"
                )
            evidence_owners[normalized_evidence] = requirement_id
            if requirement_id not in current_items:
                raise ValidationError(
                    f"{requirement_id} has no requirement definition for issue_evidence"
                )
            if normalized_evidence not in normalize(
                current_items[requirement_id].content
            ):
                raise ValidationError(
                    f"{requirement_id} issue_evidence is not present in its requirement content"
                )
            if any(
                normalized_evidence in normalize(other_item.content)
                for other_id, other_item in current_items.items()
                if other_id != requirement_id
            ):
                raise ValidationError(
                    f"{requirement_id} issue_evidence also maps to another requirement"
                )
        statuses[requirement_id] = status

    ordered_ids = sorted(statuses, key=requirement_sort_key)
    if list(statuses) != ordered_ids:
        raise ValidationError("requirements entries must use canonical ID order")
    if not any(requirement_id.startswith("FR-") for requirement_id in statuses):
        raise ValidationError("requirements must contain at least one FR- identifier")
    if not any(requirement_id.startswith("AC-") for requirement_id in statuses):
        raise ValidationError("requirements must contain at least one AC- identifier")
    return statuses


def validate_retired(
    retired: Any,
    baseline_ids: set[str],
    issue_body: str,
) -> set[str]:
    if not isinstance(retired, list):
        raise ValidationError("retired must be an array")

    retired_ids: set[str] = set()
    for index, entry in enumerate(retired):
        if not isinstance(entry, dict) or set(entry) != {"id", "issue_evidence"}:
            raise ValidationError(
                "each retired entry must contain only id and issue_evidence"
            )
        requirement_id = require_string(entry["id"], f"retired[{index}].id")
        if not is_requirement_id(requirement_id):
            raise ValidationError(f"invalid retired requirement ID: {requirement_id}")
        if requirement_id not in baseline_ids:
            raise ValidationError(
                f"retired requirement is not in Git HEAD: {requirement_id}"
            )
        if requirement_id in retired_ids:
            raise ValidationError(f"duplicate retired requirement: {requirement_id}")
        retired_ids.add(requirement_id)

        evidence = require_string(
            entry["issue_evidence"],
            f"retired[{index}].issue_evidence",
        )
        if normalize(evidence) not in normalize(issue_body):
            raise ValidationError(
                f"retired[{index}].issue_evidence is not present in the current Issue"
            )
        normalized_evidence = normalize(evidence)
        if requirement_id not in extract_requirement_mentions(evidence):
            raise ValidationError(
                f"retired evidence must name its requirement ID: {requirement_id}"
            )
        if not any(term in normalized_evidence for term in RETIREMENT_TERMS):
            raise ValidationError(
                f"retired evidence must explicitly state retirement: {requirement_id}"
            )
        if any(pattern.search(normalized_evidence) for pattern in NEGATED_RETIREMENT_PATTERNS):
            raise ValidationError(
                f"retired evidence must not negate retirement: {requirement_id}"
            )
    return retired_ids


def validate(
    issue: str,
    issue_body_path: Path,
    document_path: Path,
    document_kind: str,
    repo_root: Path,
    workspace: str,
    goal_document_path: Path | None = None,
    require_goal_document: bool = True,
) -> None:
    if document_kind == "goal" and goal_document_path is not None:
        raise ValidationError("--goal-document is only valid for artifact validation")
    if (
        document_kind == "artifact"
        and require_goal_document
        and goal_document_path is None
    ):
        raise ValidationError("artifact validation requires --goal-document")
    if (
        document_kind == "artifact"
        and goal_document_path is not None
        and goal_document_path.resolve() == document_path.resolve()
    ):
        raise ValidationError("--goal-document must be distinct from the artifact")
    validate_workspace_identity(repo_root, issue, workspace)
    if document_kind == "artifact":
        require_canonical_input(
            repo_root,
            document_path,
            canonical_source_path(Path(), workspace, "requirements"),
            "Requirements source",
        )
        source = load_source(document_path, "requirements")
    elif document_kind == "goal":
        source = load_source(document_path, "requirements_goal")
    else:
        raise ValidationError("document kind must be goal or artifact")
    if source["workspace"] != workspace:
        raise ValidationError("source workspace does not match --workspace")
    if source["validation"].get("mode") != "managed":
        raise ValidationError("normal validation requires validation.mode=managed")
    issue_body_bytes = issue_body_path.read_bytes()
    issue_body = issue_body_bytes.decode("utf-8")
    _, baseline_bytes = load_git_head_source(
        repo_root,
        workspace,
        "requirements",
    )
    manifest = extract_manifest(source)

    if manifest.get("workspace") != workspace:
        raise ValidationError("manifest workspace does not match --workspace")
    if manifest.get("issue_body_sha256") != hashlib.sha256(issue_body_bytes).hexdigest():
        raise ValidationError(
            "issue_body_sha256 does not match the supplied current Issue body"
        )
    baseline = validate_baseline(manifest.get("baseline"), baseline_bytes)
    baseline_items = baseline["requirements"]
    baseline_sections = baseline["sections"]
    current_items = structured_requirements(source)
    statuses = validate_requirements_manifest(
        manifest.get("requirements"), baseline_items, issue_body, current_items
    )
    retired_ids = validate_retired(
        manifest.get("retired"),
        set(baseline_items),
        issue_body,
    )
    current_sections = structured_sections(source) if document_kind == "artifact" else None
    if current_sections is not None and list(current_sections) != list(
        REQUIRED_REQUIREMENTS_SECTIONS
    ):
        raise ValidationError(
            "Requirements artifact must contain every canonical structured section"
        )
    section_statuses = validate_sections_manifest(
        manifest.get("sections"), baseline_sections, issue_body, current_sections
    )

    missing_baseline = set(baseline_items) - set(statuses) - retired_ids
    if missing_baseline:
        raise ValidationError(
            "Requirements transition dropped Git HEAD IDs without retirement: "
            f"{', '.join(sorted(missing_baseline, key=requirement_sort_key))}"
        )
    duplicated_baseline = set(statuses) & retired_ids
    if duplicated_baseline:
        raise ValidationError(
            "retired IDs also appear in requirements: "
            f"{', '.join(sorted(duplicated_baseline, key=requirement_sort_key))}"
        )

    if list(sorted(current_items, key=requirement_sort_key)) != list(statuses):
        raise ValidationError(
            "document requirement definitions must exactly match manifest requirements"
        )

    issue_ids = set(extract_requirement_mentions(issue_body))
    missing_issue_ids = issue_ids - set(current_items) - retired_ids
    if missing_issue_ids:
        raise ValidationError(
            "current Requirements omitted IDs explicitly present in the current Issue: "
            f"{', '.join(sorted(missing_issue_ids, key=requirement_sort_key))}"
        )

    if document_kind == "goal":
        return

    assert current_sections is not None

    for requirement_id, status in statuses.items():
        current_hash = content_sha256(current_items[requirement_id].content)
        if status == "unchanged" and current_hash != baseline_items[requirement_id]:
            raise ValidationError(
                f"unchanged requirement content changed: {requirement_id}"
            )
        if status == "changed" and current_hash == baseline_items[requirement_id]:
            raise ValidationError(
                f"changed requirement content is identical to Git HEAD: {requirement_id}"
            )

    for section_id, status in section_statuses.items():
        current_hash = content_sha256(current_sections[section_id].content)
        if status == "unchanged" and current_hash != baseline_sections[section_id]:
            raise ValidationError(f"unchanged Requirements section changed: {section_id}")
        if status == "changed" and current_hash == baseline_sections[section_id]:
            raise ValidationError(
                f"changed Requirements section is identical to Git HEAD: {section_id}"
            )

    if not require_goal_document:
        if goal_document_path is not None:
            raise ValidationError(
                "goal document must be omitted when only revalidating the artifact gate"
            )
        return

    assert goal_document_path is not None
    goal_source = load_source(goal_document_path, "requirements_goal")
    if goal_source["workspace"] != workspace:
        raise ValidationError("Goal source workspace does not match --workspace")
    if goal_source["validation"].get("mode") != "managed":
        raise ValidationError("normal validation requires validation.mode=managed")
    goal_manifest = extract_manifest(goal_source)
    if manifest != goal_manifest:
        raise ValidationError(
            "artifact Requirements Completeness Gate does not match the Goal"
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--issue", required=True)
    parser.add_argument("--issue-body", required=True, type=Path)
    parser.add_argument("--document", required=True, type=Path)
    parser.add_argument("--kind", required=True, choices=("goal", "artifact"))
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--goal-document", type=Path)
    args = parser.parse_args()

    try:
        validate(
            args.issue,
            args.issue_body,
            args.document,
            args.kind,
            args.repo_root,
            args.workspace,
            args.goal_document,
        )
    except (
        OSError,
        UnicodeDecodeError,
        json.JSONDecodeError,
        GitBaselineError,
        SourceError,
        ValidationError,
    ) as error:
        print(f"requirements completeness gate: failed: {error}", file=sys.stderr)
        return 1

    print("requirements completeness gate: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
