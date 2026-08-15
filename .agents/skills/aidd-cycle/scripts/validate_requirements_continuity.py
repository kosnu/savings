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

from artifact_source import (
    SourceError,
    load_baseline_source_bytes,
    load_source,
    load_source_bytes,
    read_regular_file_bytes,
)
from git_baseline import (
    GitBaselineError,
    canonical_source_path,
    load_git_head_source,
    require_canonical_worktree_path,
    validate_workspace_identity,
)
class ValidationError(ValueError):
    pass


@dataclass(frozen=True)
class StructuredRequirement:
    section_id: str | None
    text: str


@dataclass(frozen=True)
class StructuredSection:
    heading: str
    blocks: tuple[dict[str, Any], ...] | None
    content: str


REQUIRED_REQUIREMENTS_SECTIONS = (
    "background",
    "users",
    "stories",
    "scope",
    "functional",
    "non-functional",
    "acceptance",
    "qa",
    "technical",
)
LEGACY_REQUIRED_REQUIREMENTS_SECTIONS = tuple(
    "non_functional" if section_id == "non-functional" else section_id
    for section_id in REQUIRED_REQUIREMENTS_SECTIONS
)
SECTION_HEADINGS = {
    "background": "背景",
    "users": "対象ユーザー",
    "stories": "ユーザーストーリー",
    "scope": "スコープ",
    "functional": "機能要件",
    "non-functional": "非機能要件",
    "non_functional": "非機能要件",
    "acceptance": "受け入れ条件",
    "qa": "Q&A",
    "technical": "技術的考慮事項",
}
REQUIREMENT_ID_PATTERN = re.compile(r"(?:FR|NFR|AC)-[1-9][0-9]*")
REQUIREMENT_MENTION_PATTERN = re.compile(
    r"(?<![A-Z0-9_-])(?:FR|NFR|AC)-[1-9][0-9]*(?![A-Z0-9_-])"
)
REQUIREMENT_PREFIX_ORDER = {"FR": 0, "NFR": 1, "AC": 2}
REQUIREMENT_SECTION_BY_PREFIX = {
    "FR": "functional",
    "NFR": "non-functional",
    "AC": "acceptance",
}


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


def is_requirement_id(value: str) -> bool:
    return REQUIREMENT_ID_PATTERN.fullmatch(value) is not None


def requirement_sort_key(requirement_id: str) -> tuple[int, int]:
    prefix, number = requirement_id.split("-", 1)
    return REQUIREMENT_PREFIX_ORDER[prefix], int(number)


def extract_requirement_mentions(value: str) -> tuple[str, ...]:
    return tuple(
        sorted(set(REQUIREMENT_MENTION_PATTERN.findall(value)), key=requirement_sort_key)
    )


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
    return hashlib.sha256(value.replace("\r\n", "\n").encode("utf-8")).hexdigest()


def structured_sha256(value: Any) -> str:
    """Hash JSON structure after newline normalization, without parsing strings."""

    def normalize_newlines(item: Any) -> Any:
        if isinstance(item, str):
            return item.replace("\r\n", "\n")
        if isinstance(item, list):
            return [normalize_newlines(entry) for entry in item]
        if isinstance(item, dict):
            return {
                key: normalize_newlines(entry)
                for key, entry in item.items()
            }
        return item

    serialized = json.dumps(
        normalize_newlines(value),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


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


def structured_requirements(
    source: dict[str, Any],
) -> dict[str, StructuredRequirement]:
    entries = source["validation"].get("requirements")
    if not isinstance(entries, list):
        raise ValidationError("validation.requirements must be an array")
    is_legacy_inventory = source.get("schema_version") == 1
    is_goal = source.get("kind") == "requirements_goal"
    items: dict[str, StructuredRequirement] = {}
    for index, entry in enumerate(entries):
        expected_keys = (
            {"id", "content"}
            if is_legacy_inventory
            else ({"id", "text"} if is_goal else {"id", "section_id", "text"})
        )
        if not isinstance(entry, dict) or set(entry) != expected_keys:
            raise ValidationError(
                "each validation.requirements entry must match its schema"
            )
        requirement_id = require_string(entry["id"], f"requirements[{index}].id")
        if not is_requirement_id(requirement_id):
            raise ValidationError(f"invalid structured requirement ID: {requirement_id}")
        text_field = "content" if is_legacy_inventory else "text"
        require_string(entry[text_field], f"requirements[{index}].{text_field}")
        text = entry[text_field]
        require_substantive_requirement_content(requirement_id, text)
        section_id = None
        if not is_legacy_inventory and not is_goal:
            section_id = require_string(
                entry["section_id"], f"requirements[{index}].section_id"
            )
            prefix = requirement_id.split("-", 1)[0]
            if section_id != REQUIREMENT_SECTION_BY_PREFIX[prefix]:
                raise ValidationError(
                    f"{requirement_id} must reference "
                    f"{REQUIREMENT_SECTION_BY_PREFIX[prefix]} section"
                )
        if requirement_id in items:
            raise ValidationError(f"duplicate structured requirement: {requirement_id}")
        items[requirement_id] = StructuredRequirement(section_id, text)
    if list(items) != sorted(items, key=requirement_sort_key):
        raise ValidationError("structured requirements must use canonical ID order")
    return items


def structured_sections(source: dict[str, Any]) -> dict[str, StructuredSection]:
    entries = source["validation"].get("sections")
    if not isinstance(entries, list):
        raise ValidationError("validation.sections must be an array")
    is_legacy_inventory = source.get("schema_version") == 1
    sections: dict[str, StructuredSection] = {}
    for index, entry in enumerate(entries):
        expected_keys = (
            {"id", "heading", "content"}
            if is_legacy_inventory
            else {"id", "heading", "blocks"}
        )
        if not isinstance(entry, dict) or set(entry) != expected_keys:
            raise ValidationError(
                "each validation.sections entry must match its schema"
            )
        section_id = require_string(entry["id"], f"sections[{index}].id")
        if is_legacy_inventory and section_id == "non_functional":
            section_id = "non-functional"
        heading = require_string(entry["heading"], f"sections[{index}].heading")
        canonical_heading = SECTION_HEADINGS.get(section_id)
        if canonical_heading is None or not heading.startswith(canonical_heading):
            raise ValidationError(
                f"section {section_id} heading does not match its canonical aliases"
            )
        if is_legacy_inventory:
            require_string(entry["content"], f"sections[{index}].content")
            content = entry["content"]
            blocks = None
        else:
            raw_blocks = entry["blocks"]
            if not isinstance(raw_blocks, list) or not raw_blocks:
                raise ValidationError(f"sections[{index}].blocks must be non-empty")
            blocks = tuple(raw_blocks)
            content = json.dumps(
                raw_blocks,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            )
        if section_id in sections:
            raise ValidationError(f"duplicate structured section: {section_id}")
        sections[section_id] = StructuredSection(heading, blocks, content)
    canonical_sections = REQUIRED_REQUIREMENTS_SECTIONS
    expected_order = [
        section_id for section_id in canonical_sections if section_id in sections
    ]
    if list(sections) != expected_order:
        raise ValidationError("structured sections must use canonical section order")
    return sections


def baseline_item_manifest(baseline_bytes: bytes) -> list[dict[str, str]]:
    items = structured_requirements(
        load_baseline_source_bytes(baseline_bytes, "requirements")
    )
    if not items:
        raise ValidationError(
            "Git HEAD Requirements baseline has no stable requirement definitions"
        )
    return [
        {"id": requirement_id, "content_sha256": content_sha256(items[requirement_id].text)}
        for requirement_id in sorted(items, key=requirement_sort_key)
    ]


def baseline_section_manifest(baseline_bytes: bytes) -> list[dict[str, str]]:
    source = load_baseline_source_bytes(baseline_bytes, "requirements")
    sections = structured_sections(source)
    canonical_sections = REQUIRED_REQUIREMENTS_SECTIONS
    return [
        {
            "id": section_id,
            "content_sha256": (
                content_sha256(sections[section_id].content)
                if sections[section_id].blocks is None
                else structured_sha256(list(sections[section_id].blocks))
            ),
        }
        for section_id in canonical_sections
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
    current_sections: dict[str, StructuredSection] | None,
    current_items: dict[str, StructuredRequirement],
) -> dict[str, str]:
    if not isinstance(sections, list):
        raise ValidationError("sections must be an array")
    expected_ids = list(REQUIRED_REQUIREMENTS_SECTIONS)
    if [entry.get("id") if isinstance(entry, dict) else None for entry in sections] != expected_ids:
        raise ValidationError(
            "sections must contain every canonical Requirements section in order"
        )

    normalized_issue_body = normalize(issue_body)
    normalized_section_contents: dict[str, str] = {}
    if current_sections is not None:
        for section_id, section in current_sections.items():
            content_parts: list[str] = []
            if section.blocks is None:
                content_parts.append(section.content)
            else:
                for block in section.blocks:
                    if block["type"] == "markdown":
                        content_parts.append(block["markdown"])
                    elif block["type"] == "evidence":
                        content_parts.append(block["text"])
                    elif block["type"] == "requirements":
                        content_parts.extend(
                            item.text
                            for item in current_items.values()
                            if item.section_id == section_id
                        )
            normalized_section_contents[section_id] = normalize(
                "\n".join(content_parts)
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
            if normalize(evidence) not in normalized_issue_body:
                raise ValidationError(
                    f"{section_id} section evidence is not in the current Issue"
                )
            normalized_evidence = normalize(evidence)
            if normalized_evidence in evidence_owners:
                raise ValidationError(
                    "changed or new section issue_evidence must be unique per section"
                )
            evidence_owners[normalized_evidence] = section_id
            if current_sections is not None:
                if normalized_evidence not in normalized_section_contents[section_id]:
                    raise ValidationError(
                        f"{section_id} section evidence is not present in its section content"
                    )
                if any(
                    normalized_evidence in other_content
                    for other_id, other_content in normalized_section_contents.items()
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

    normalized_issue_body = normalize(issue_body)
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
            if normalize(evidence) not in normalized_issue_body:
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
            if normalized_evidence not in normalize(current_items[requirement_id].text):
                raise ValidationError(
                    f"{requirement_id} issue_evidence is not present in its requirement text"
                )
            if any(
                normalized_evidence in normalize(other_item.text)
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
    document_bytes: bytes | None = None,
    issue_body_bytes: bytes | None = None,
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
        source = (
            load_source_bytes(document_bytes, "requirements")
            if document_bytes is not None
            else load_source(document_path, "requirements")
        )
    elif document_kind == "goal":
        source = (
            load_source_bytes(document_bytes, "requirements_goal")
            if document_bytes is not None
            else load_source(document_path, "requirements_goal")
        )
    else:
        raise ValidationError("document kind must be goal or artifact")
    if source["workspace"] != workspace:
        raise ValidationError("source workspace does not match --workspace")
    if source["validation"].get("mode") != "managed":
        raise ValidationError("normal validation requires validation.mode=managed")
    if issue_body_bytes is None:
        issue_body_bytes = read_regular_file_bytes(issue_body_path)
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
        manifest.get("sections"),
        baseline_sections,
        issue_body,
        current_sections,
        current_items,
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

    for requirement_id, status in statuses.items():
        current_hash = content_sha256(current_items[requirement_id].text)
        if status == "unchanged" and current_hash != baseline_items[requirement_id]:
            raise ValidationError(
                f"unchanged requirement content changed: {requirement_id}"
            )
        if status == "changed" and current_hash == baseline_items[requirement_id]:
            raise ValidationError(
                f"changed requirement content is identical to Git HEAD: {requirement_id}"
            )

    if document_kind == "goal":
        return

    assert current_sections is not None

    for section_id, status in section_statuses.items():
        section = current_sections[section_id]
        current_hash = (
            content_sha256(section.content)
            if section.blocks is None
            else structured_sha256(list(section.blocks))
        )
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
