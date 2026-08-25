"""Load and validate structured AIDD Goal and artifact sources."""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import stat
import sys
import unicodedata
from pathlib import Path, PurePosixPath
from typing import Any

sys.dont_write_bytecode = True

from section_aliases import exact_requirement_section_ids_for_heading

SCHEMA_VERSION = 3
LEGACY_SCHEMA_VERSION = 2
SUPPORTED_SCHEMA_VERSIONS = {LEGACY_SCHEMA_VERSION, SCHEMA_VERSION}
ARTIFACT_KINDS = {"requirements", "design"}
GOAL_KINDS = {"requirements_goal", "design_goal"}
SUPPORTED_KINDS = ARTIFACT_KINDS | GOAL_KINDS
SOURCE_FILENAMES = {
    "requirements": "requirements.json",
    "design": "design-doc.json",
}
DISPLAY_FILENAMES = {
    "requirements": "requirements.md",
    "design": "design-doc.md",
    "requirements_goal": "goal.md",
    "design_goal": "goal.md",
}
MANAGED_VALIDATION_KEYS = {
    "requirements": {
        "mode",
        "cycle_start_issue_title",
        "input_gate",
        "completeness_gate",
        "requirements",
        "sections",
    },
    "design": {
        "mode",
        "product_behaviors",
        "rule_coverage",
        "coverage_gate",
        "sections",
    },
}
MANAGED_V3_VALIDATION_KEYS = {
    **MANAGED_VALIDATION_KEYS,
    "design": {
        "mode",
        "target_state",
        "rule_coverage",
        "coverage_gate",
        "sections",
    },
}
MANAGED_GOAL_VALIDATION_KEYS = {
    "requirements_goal": {
        "mode",
        "cycle_start_issue_title",
        "input_gate",
        "completeness_gate",
        "requirements",
    },
    "design_goal": {
        "mode",
        "coverage_gate",
        "product_behaviors",
        "rule_coverage",
        "scopes",
        "baseline_scopes",
    },
}
MANAGED_V3_GOAL_VALIDATION_KEYS = {
    **MANAGED_GOAL_VALIDATION_KEYS,
    "design_goal": {
        "mode",
        "coverage_gate",
        "target_state",
        "rule_coverage",
        "scopes",
        "baseline_scopes",
    },
}
DESIGN_GOAL_GATE_KEYS = {
    "requirements_sha256",
    "workspace",
    "requirement_ids",
    "baseline",
}
MANAGED_GATE_KEYS = {
    "requirements": {
        "input_gate": {"task_context", "direct_rules", "depends_on"},
        "completeness_gate": {
            "issue_body_sha256",
            "workspace",
            "baseline",
            "requirements",
            "sections",
            "retired",
        },
    },
    "design": {
        "coverage_gate": {
            "requirements_sha256",
            "workspace",
            "requirement_ids",
            "baseline",
            "coverage",
            "baseline_sections",
        }
    },
}
BLOCK_ID_PATTERN = re.compile(r"[a-z0-9][a-z0-9-]*")
REQUIREMENT_ID_PATTERN = re.compile(r"(?P<prefix>FR|NFR|AC)-(?P<number>[1-9][0-9]*)")
PRODUCT_BEHAVIOR_ID_PATTERN = re.compile(r"PB-(?P<number>[1-9][0-9]*)")
VERIFICATION_CASE_ID_PATTERN = re.compile(r"VC-(?P<number>[1-9][0-9]*)")
REPRESENTATION_ID_PATTERN = re.compile(r"REP-(?P<number>[1-9][0-9]*)")
EXPORT_NAME_PATTERN = re.compile(r"[A-Za-z_$][A-Za-z0-9_$]*")
REQUIREMENT_PREFIX_ORDER = {"FR": 0, "NFR": 1, "AC": 2}
WORKSPACE_PATTERN = re.compile(r"[a-z0-9][a-z0-9-]*")
DIGEST_PATTERN = re.compile(r"[0-9a-f]{64}")
MAX_SOURCE_BYTES = 16 * 1024 * 1024
EVIDENCE_ROLES = {"design", "verification", "baseline"}
MIN_SUBSTANTIVE_TEXT_LENGTH = 8
GOAL_REQUIRED_CONTRACT = {
    "requirements_goal": {
        "constraints": (
            (
                "task-context",
                "最新Issue本文だけをTask Context正本として扱う。",
            ),
            ("phase-boundary", "Requirements Goal内では実装しない。"),
        ),
        "stop": (
            (
                "validation-failure",
                "workspaceまたはRequirements Gateの検証が"
                "失敗した場合は停止する。",
            ),
            (
                "scope-ambiguity",
                "Issue本文から要求scopeを一意に決められない場合は"
                "停止する。",
            ),
        ),
        "done": (
            (
                "complete-scope",
                "最新Issue全体を覆うRequirementsと全要求IDを定義する。",
            ),
            (
                "validated-artifact",
                "Requirements Gateと生成成果物の同期検証を成功させる。",
            ),
        ),
    },
    "design_goal": {
        "constraints": (
            (
                "canonical-input",
                "検証済みのcanonical requirements.jsonをread-only入力として扱う。",
            ),
            ("phase-boundary", "Design Goal内では実装しない。"),
        ),
        "stop": (
            (
                "validation-failure",
                "Requirements再検証またはDesign Coverage Gateが"
                "失敗した場合は停止する。",
            ),
            (
                "scope-ambiguity",
                "要求ごとの設計・検証scopeを一意に決められない場合は"
                "停止する。",
            ),
        ),
        "done": (
            (
                "complete-scope",
                "全Requirements IDとbaseline sectionのDesign coverageを定義する。",
            ),
            (
                "validated-artifact",
                "Design Coverage Gateと生成成果物の同期検証後に"
                "completion receiptを固定する。",
            ),
        ),
    },
}
V3_DESIGN_GOAL_REQUIRED_CONTRACT = {
    **GOAL_REQUIRED_CONTRACT["design_goal"],
    "done": (
        (
            "complete-scope",
            "全Requirements IDとtask-owned範囲の完成状態を定義する。",
        ),
        GOAL_REQUIRED_CONTRACT["design_goal"]["done"][1],
    ),
}
EVIDENCE_PLACEHOLDERS = {
    "pending",
    "tbd",
    "todo",
    "na",
    "未定",
    "なし",
}


class SourceError(ValueError):
    pass


def is_requirement_id(value: str) -> bool:
    return REQUIREMENT_ID_PATTERN.fullmatch(value) is not None


def requirement_sort_key(value: str) -> tuple[int, int]:
    match = REQUIREMENT_ID_PATTERN.fullmatch(value)
    if match is None:
        raise SourceError(f"invalid requirement ID: {value}")
    return REQUIREMENT_PREFIX_ORDER[match.group("prefix")], int(match.group("number"))


def product_behavior_sort_key(value: str) -> int:
    match = PRODUCT_BEHAVIOR_ID_PATTERN.fullmatch(value)
    if match is None:
        raise SourceError(f"invalid product behavior ID: {value}")
    return int(match.group("number"))


def numbered_id_sort_key(value: str, pattern: re.Pattern[str], label: str) -> int:
    match = pattern.fullmatch(value)
    if match is None:
        raise SourceError(f"invalid {label} ID: {value}")
    return int(match.group("number"))


def verification_case_sort_key(value: str) -> int:
    return numbered_id_sort_key(value, VERIFICATION_CASE_ID_PATTERN, "verification case")


def representation_sort_key(value: str) -> int:
    return numbered_id_sort_key(value, REPRESENTATION_ID_PATTERN, "representation")


def structured_sha256(value: Any) -> str:
    """Hash JSON structure after newline normalization."""

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


def normalize_markdown_newlines(markdown: str) -> str:
    return markdown.replace("\r\n", "\n")


def require_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise SourceError(f"{label} must be a non-empty string")
    return value


def require_inline_markdown(value: Any, label: str) -> str:
    """Require a single display line without interpreting Markdown syntax."""

    text = require_string(value, label)
    if "\n" in text or "\r" in text:
        raise SourceError(f"{label} must be a single line")
    return text


def require_evidence_text(value: Any, label: str) -> str:
    text = require_inline_markdown(value, label)
    if is_placeholder_text(text):
        raise SourceError(f"{label} must contain substantive evidence")
    return text


def canonical_substantive_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    return "".join(
        character
        for character in normalized
        if unicodedata.category(character)[0] not in {"P", "S", "Z", "C", "M"}
    )


def is_placeholder_text(value: str) -> bool:
    canonical = canonical_substantive_text(value)
    return not canonical or canonical in EVIDENCE_PLACEHOLDERS


def require_substantive_inline_text(value: Any, label: str) -> str:
    text = require_inline_markdown(value, label)
    if (
        is_placeholder_text(text)
        or len(canonical_substantive_text(text)) < MIN_SUBSTANTIVE_TEXT_LENGTH
    ):
        raise SourceError(
            f"{label} must contain at least "
            f"{MIN_SUBSTANTIVE_TEXT_LENGTH} substantive characters"
        )
    return text


def require_object_keys(value: Any, expected: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != expected:
        raise SourceError(f"{label} has invalid keys")
    return value


def require_object_array(value: Any, label: str) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not all(
        isinstance(entry, dict) for entry in value
    ):
        raise SourceError(f"{label} must be an object array")
    return value


def require_goal_contract_entries(
    value: Any,
    label: str,
    required_contract: tuple[tuple[str, str], ...],
) -> list[dict[str, Any]]:
    entries = require_object_array(value, label)
    if not entries:
        raise SourceError(f"{label} must be non-empty")
    ids: list[str] = []
    for index, entry in enumerate(entries):
        entry_label = f"{label}[{index}]"
        require_object_keys(entry, {"id", "text"}, entry_label)
        contract_id = require_string(entry["id"], f"{entry_label}.id")
        if BLOCK_ID_PATTERN.fullmatch(contract_id) is None:
            raise SourceError(f"{entry_label}.id must use lowercase ASCII kebab-case")
        if contract_id in ids:
            raise SourceError(f"duplicate {label} ID: {contract_id}")
        ids.append(contract_id)
        require_substantive_inline_text(entry["text"], f"{entry_label}.text")

    required_ids = [contract_id for contract_id, _ in required_contract]
    if ids[: len(required_contract)] != required_ids:
        raise SourceError(
            f"{label} must contain required IDs in canonical order: "
            f"{', '.join(required_ids)}"
        )
    for index, (contract_id, canonical_text) in enumerate(required_contract):
        if entries[index]["text"] != canonical_text:
            raise SourceError(
                f"{label} required ID {contract_id} must use canonical text"
            )
    return entries


def require_string_array(value: Any, label: str) -> list[str]:
    if not isinstance(value, list) or not all(
        isinstance(entry, str) and entry.strip() for entry in value
    ):
        raise SourceError(f"{label} must be a string array")
    return value


def require_digest(value: Any, label: str) -> str:
    digest = require_string(value, label)
    if DIGEST_PATTERN.fullmatch(digest) is None:
        raise SourceError(f"{label} must be a lowercase SHA-256 digest")
    return digest


def validate_baseline_shape(value: Any, label: str) -> None:
    baseline = require_object_keys(value, {"source", "body_sha256"}, label)
    source = require_string(baseline["source"], f"{label}.source")
    if source == "none" and baseline["body_sha256"] is None:
        return
    if source != "git_head":
        raise SourceError(f"{label}.source must be none or git_head")
    require_digest(baseline["body_sha256"], f"{label}.body_sha256")


def validate_requirements_input_gate(value: Any) -> None:
    gate = require_object_keys(
        value,
        {"task_context", "direct_rules", "depends_on"},
        "managed requirements input_gate",
    )
    task_context = require_object_keys(
        gate["task_context"],
        {"source", "issue", "url", "updated_at", "body_sha256"},
        "managed requirements task_context",
    )
    for field in task_context:
        if field == "body_sha256":
            require_digest(task_context[field], f"task_context.{field}")
        else:
            require_string(task_context[field], f"task_context.{field}")
    direct_rules = require_object_array(
        gate["direct_rules"], "managed requirements direct_rules"
    )
    if not direct_rules:
        raise SourceError("managed requirements direct_rules must be non-empty")
    for index, entry in enumerate(direct_rules):
        required = {"id", "issue_evidence", "match", "reason"}
        if not required.issubset(entry) or set(entry) - required - {"explicit_surface"}:
            raise SourceError(
                f"managed requirements direct_rules[{index}] has invalid keys"
            )
        for field in required - {"match"}:
            if field in {"id", "reason"}:
                require_inline_markdown(
                    entry[field], f"direct_rules[{index}].{field}"
                )
            else:
                require_string(entry[field], f"direct_rules[{index}].{field}")
        if "explicit_surface" in entry:
            require_string(
                entry["explicit_surface"],
                f"direct_rules[{index}].explicit_surface",
            )
        match = require_object_keys(
            entry["match"], {"field", "value"}, f"direct_rules[{index}].match"
        )
        require_string(match["field"], f"direct_rules[{index}].match.field")
        require_string(match["value"], f"direct_rules[{index}].match.value")
    for index, entry in enumerate(
        require_object_array(gate["depends_on"], "managed requirements depends_on")
    ):
        require_object_keys(entry, {"id", "via"}, f"depends_on[{index}]")
        require_inline_markdown(entry["id"], f"depends_on[{index}].id")
        require_inline_markdown(entry["via"], f"depends_on[{index}].via")


def validate_requirements_completeness_gate(value: Any) -> None:
    gate = require_object_keys(
        value,
        MANAGED_GATE_KEYS["requirements"]["completeness_gate"],
        "managed requirements completeness_gate",
    )
    require_digest(gate["issue_body_sha256"], "completeness_gate.issue_body_sha256")
    require_string(gate["workspace"], "completeness_gate.workspace")
    validate_baseline_shape(gate["baseline"], "completeness_gate.baseline")
    for field in ("requirements", "sections"):
        for index, entry in enumerate(
            require_object_array(gate[field], f"completeness_gate.{field}")
        ):
            require_object_keys(
                entry,
                {"id", "status", "issue_evidence"},
                f"completeness_gate.{field}[{index}]",
            )
            require_string(entry["id"], f"completeness_gate.{field}[{index}].id")
            require_string(
                entry["status"], f"completeness_gate.{field}[{index}].status"
            )
            evidence = entry["issue_evidence"]
            if evidence is not None:
                require_string(
                    evidence,
                    f"completeness_gate.{field}[{index}].issue_evidence",
                )
    for index, entry in enumerate(
        require_object_array(gate["retired"], "completeness_gate.retired")
    ):
        require_object_keys(
            entry, {"id", "issue_evidence"}, f"completeness_gate.retired[{index}]"
        )
        require_string(entry["id"], f"completeness_gate.retired[{index}].id")
        require_string(
            entry["issue_evidence"],
            f"completeness_gate.retired[{index}].issue_evidence",
        )


def validate_design_goal_coverage_gate(value: Any) -> None:
    """Validate the exact pre-Design snapshot gate and its invariants."""

    gate = require_object_keys(
        value,
        DESIGN_GOAL_GATE_KEYS,
        "managed design_goal coverage_gate",
    )
    require_digest(
        gate["requirements_sha256"],
        "design_goal coverage_gate.requirements_sha256",
    )
    workspace = require_string(
        gate["workspace"], "design_goal coverage_gate.workspace"
    )
    validate_workspace_name(workspace)
    requirement_ids = require_string_array(
        gate["requirement_ids"], "design_goal coverage_gate.requirement_ids"
    )
    if (
        any(not is_requirement_id(value) for value in requirement_ids)
        or requirement_ids != sorted(set(requirement_ids), key=requirement_sort_key)
        or not any(value.startswith("FR-") for value in requirement_ids)
        or not any(value.startswith("AC-") for value in requirement_ids)
    ):
        raise SourceError(
            "design_goal coverage_gate.requirement_ids must be canonical and complete"
        )
    baseline = require_object_keys(
        gate["baseline"],
        {"source", "body_sha256"},
        "design_goal coverage_gate.baseline",
    )
    if baseline == {"source": "none", "body_sha256": None}:
        return
    if baseline.get("source") != "git_head":
        raise SourceError(
            "design_goal coverage_gate.baseline source must be none or git_head"
        )
    require_digest(
        baseline.get("body_sha256"),
        "design_goal coverage_gate.baseline.body_sha256",
    )


def validate_workspace_name(workspace: str) -> None:
    if WORKSPACE_PATTERN.fullmatch(workspace) is None:
        raise SourceError("workspace must use lowercase ASCII kebab-case")


def canonical_source_path(repo_root: Path, workspace: str, kind: str) -> Path:
    validate_workspace_name(workspace)
    if kind not in ARTIFACT_KINDS:
        raise SourceError(f"unsupported artifact kind: {kind}")
    return (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / workspace
        / SOURCE_FILENAMES[kind]
    )


def canonical_display_path(repo_root: Path, workspace: str, kind: str) -> Path:
    validate_workspace_name(workspace)
    if kind not in ARTIFACT_KINDS:
        raise SourceError(f"unsupported artifact kind: {kind}")
    return (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / workspace
        / DISPLAY_FILENAMES[kind]
    )


def validate_source(value: Any, expected_kind: str | None = None) -> dict[str, Any]:
    """Validate the envelope without interpreting human-readable Markdown."""

    source = require_object_keys(
        value,
        {"schema_version", "kind", "workspace", "display", "validation"},
        "AIDD source",
    )
    version = source["schema_version"]
    if type(version) is not int or version not in SUPPORTED_SCHEMA_VERSIONS:
        raise SourceError(f"unsupported AIDD schema_version: {version}")
    kind = require_string(source["kind"], "kind")
    if kind not in SUPPORTED_KINDS:
        raise SourceError(f"unsupported AIDD source kind: {kind}")
    if expected_kind is not None and kind != expected_kind:
        raise SourceError(f"AIDD source kind must be {expected_kind}")
    workspace = require_string(source["workspace"], "workspace")
    validate_workspace_name(workspace)
    validation = source["validation"]
    if not isinstance(validation, dict):
        raise SourceError("validation must be an object")

    display = source["display"]
    if kind in ARTIFACT_KINDS:
        require_object_keys(display, {"path", "preamble"}, "managed display")
        require_string(display["preamble"], "managed display.preamble")
    else:
        require_object_keys(
            display,
            {"path", "title", "goal", "context", "done"},
            "managed Goal display",
        )
        require_inline_markdown(display["title"], "display.title")
        require_substantive_inline_text(display["goal"], "display.goal")
        context = require_object_keys(
            display["context"],
            {"body", "constraints", "stop"},
            "display.context",
        )
        require_string_array(context["body"], "display.context.body")
        if not context["body"]:
            raise SourceError("display.context.body must be non-empty")
        for index, entry in enumerate(context["body"]):
            require_substantive_inline_text(
                entry, f"display.context.body[{index}]"
            )
        required_contract = (
            V3_DESIGN_GOAL_REQUIRED_CONTRACT
            if kind == "design_goal" and version == SCHEMA_VERSION
            else GOAL_REQUIRED_CONTRACT[kind]
        )
        require_goal_contract_entries(
            context["constraints"],
            "display.context.constraints",
            required_contract["constraints"],
        )
        require_goal_contract_entries(
            context["stop"],
            "display.context.stop",
            required_contract["stop"],
        )
        require_goal_contract_entries(
            display["done"],
            "display.done",
            required_contract["done"],
        )

    display_path = require_string(display["path"], "display.path")
    if display_path != DISPLAY_FILENAMES[kind]:
        raise SourceError(
            f"display.path must be {DISPLAY_FILENAMES[kind]} for {kind}"
        )
    return source


def validate_blocks(
    blocks: Any,
    label: str,
    block_ids: set[str],
    *,
    allow_requirements: bool,
) -> list[dict[str, Any]]:
    entries = require_object_array(blocks, label)
    if not entries:
        raise SourceError(f"{label} must be non-empty")
    for index, block in enumerate(entries):
        block_label = f"{label}[{index}]"
        block_type = block.get("type")
        if block_type == "markdown":
            require_object_keys(block, {"id", "type", "markdown"}, block_label)
            require_string(block["markdown"], f"{block_label}.markdown")
        elif block_type == "evidence":
            role = require_string(block.get("role"), f"{block_label}.role")
            expected_keys = {"id", "type", "role", "owner_id", "text"}
            if role == "design":
                expected_keys.add("product_behavior_ids")
            require_object_keys(
                block,
                expected_keys,
                block_label,
            )
            if role not in EVIDENCE_ROLES:
                raise SourceError(f"{block_label}.role is unsupported")
            require_inline_markdown(block["owner_id"], f"{block_label}.owner_id")
            require_evidence_text(block["text"], f"{block_label}.text")
            if role == "design":
                behavior_ids = require_string_array(
                    block["product_behavior_ids"],
                    f"{block_label}.product_behavior_ids",
                )
                if behavior_ids != sorted(
                    set(behavior_ids), key=product_behavior_sort_key
                ):
                    raise SourceError(
                        f"{block_label}.product_behavior_ids must be canonical and unique"
                    )
        elif block_type == "requirements" and allow_requirements:
            require_object_keys(block, {"id", "type"}, block_label)
        else:
            raise SourceError(f"{block_label}.type is unsupported")
        block_id = require_string(block["id"], f"{block_label}.id")
        if BLOCK_ID_PATTERN.fullmatch(block_id) is None:
            raise SourceError(f"{block_label}.id must use lowercase ASCII kebab-case")
        if block_id in block_ids:
            raise SourceError(f"duplicate block ID: {block_id}")
        block_ids.add(block_id)
    return entries


def validate_v2_sections(
    sections: Any,
    kind: str,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    entries = require_object_array(sections, f"managed {kind} sections")
    if not entries:
        raise SourceError(f"managed {kind} sections must be non-empty")
    section_ids: set[str] = set()
    headings: set[str] = set()
    block_ids: set[str] = set()
    sections_by_id: dict[str, dict[str, Any]] = {}
    blocks_by_id: dict[str, dict[str, Any]] = {}
    for index, section in enumerate(entries):
        label = f"sections[{index}]"
        require_object_keys(section, {"id", "heading", "blocks"}, label)
        section_id = require_string(section["id"], f"{label}.id")
        if BLOCK_ID_PATTERN.fullmatch(section_id) is None:
            raise SourceError(f"{label}.id must use lowercase ASCII kebab-case")
        if section_id in section_ids:
            raise SourceError(f"duplicate section ID: {section_id}")
        heading = require_inline_markdown(section["heading"], f"{label}.heading")
        if (
            kind == "requirements"
            and exact_requirement_section_ids_for_heading(heading)
            != (section_id,)
        ):
            raise SourceError(
                f"{label}.heading must map to exactly one canonical section"
            )
        if heading in headings:
            raise SourceError(f"duplicate section heading: {heading}")
        blocks = validate_blocks(
            section["blocks"],
            f"{label}.blocks",
            block_ids,
            allow_requirements=kind == "requirements",
        )
        section_ids.add(section_id)
        headings.add(heading)
        sections_by_id[section_id] = section
        for block in blocks:
            blocks_by_id[block["id"]] = block
    return entries, sections_by_id, blocks_by_id


def validate_v2_requirements(
    requirements: Any,
    sections_by_id: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    entries = require_object_array(requirements, "managed requirements requirements")
    if not entries:
        raise SourceError("managed requirements requirements must be non-empty")
    ids: list[str] = []
    section_requirement_counts: dict[str, int] = {
        section_id: 0 for section_id in sections_by_id
    }
    for index, entry in enumerate(entries):
        label = f"requirements[{index}]"
        require_object_keys(entry, {"id", "section_id", "text"}, label)
        requirement_id = require_string(entry["id"], f"{label}.id")
        if not is_requirement_id(requirement_id):
            raise SourceError(f"invalid requirement ID: {requirement_id}")
        section_id = require_string(entry["section_id"], f"{label}.section_id")
        if section_id not in sections_by_id:
            raise SourceError(f"unknown requirement section: {section_id}")
        require_inline_markdown(entry["text"], f"{label}.text")
        ids.append(requirement_id)
        section_requirement_counts[section_id] += 1
    if ids != sorted(set(ids), key=requirement_sort_key):
        raise SourceError("managed requirement IDs must be unique and canonical")
    for section_id, section in sections_by_id.items():
        requirement_blocks = sum(
            block["type"] == "requirements" for block in section["blocks"]
        )
        expected = 1 if section_requirement_counts[section_id] else 0
        if requirement_blocks != expected:
            raise SourceError(
                f"section {section_id} must contain {expected} requirements block"
            )
    return entries


def validate_design_coverage_gate(
    value: Any,
    blocks_by_id: dict[str, dict[str, Any]] | None = None,
) -> None:
    gate = require_object_keys(
        value,
        MANAGED_GATE_KEYS["design"]["coverage_gate"],
        "managed design coverage_gate",
    )
    require_digest(gate["requirements_sha256"], "coverage_gate.requirements_sha256")
    require_string(gate["workspace"], "coverage_gate.workspace")
    requirement_ids = require_string_array(
        gate["requirement_ids"], "coverage_gate.requirement_ids"
    )
    if requirement_ids != sorted(set(requirement_ids), key=requirement_sort_key):
        raise SourceError("coverage_gate.requirement_ids must be canonical and unique")
    validate_baseline_shape(gate["baseline"], "coverage_gate.baseline")
    references: list[str] = []
    coverage_ids: list[str] = []
    for index, entry in enumerate(
        require_object_array(gate["coverage"], "coverage_gate.coverage")
    ):
        label = f"coverage_gate.coverage[{index}]"
        require_object_keys(
            entry,
            {"id", "design_block_id", "verification_block_id"},
            label,
        )
        coverage_ids.append(require_string(entry["id"], f"{label}.id"))
        for field, expected_role in (
            ("design_block_id", "design"),
            ("verification_block_id", "verification"),
        ):
            block_id = require_string(entry[field], f"{label}.{field}")
            references.append(block_id)
            if blocks_by_id is not None:
                block = blocks_by_id.get(block_id)
                if block is None or block.get("type") != "evidence":
                    raise SourceError(f"{label}.{field} must reference an evidence block")
                if block.get("role") != expected_role or block.get("owner_id") != entry["id"]:
                    raise SourceError(
                        f"{label}.{field} must reference {expected_role} evidence owned by {entry['id']}"
                    )
    if coverage_ids != requirement_ids:
        raise SourceError("coverage IDs must exactly match requirement_ids")
    baseline_headings: set[str] = set()
    for index, entry in enumerate(
        require_object_array(gate["baseline_sections"], "coverage_gate.baseline_sections")
    ):
        label = f"coverage_gate.baseline_sections[{index}]"
        status = require_string(entry.get("status"), f"{label}.status")
        if status not in {"preserved", "replaced"}:
            raise SourceError(f"{label}.status must be preserved or replaced")
        expected_keys = {"section_id", "heading", "content_sha256", "status"}
        if status == "replaced":
            expected_keys.add("design_block_id")
        require_object_keys(entry, expected_keys, label)
        section_id = entry["section_id"]
        if section_id is not None:
            require_string(section_id, f"{label}.section_id")
            if BLOCK_ID_PATTERN.fullmatch(section_id) is None:
                raise SourceError(
                    f"{label}.section_id must use lowercase ASCII kebab-case"
                )
        heading = require_string(entry["heading"], f"{label}.heading")
        require_digest(entry["content_sha256"], f"{label}.content_sha256")
        if status == "replaced":
            block_id = require_string(entry["design_block_id"], f"{label}.design_block_id")
            references.append(block_id)
            if blocks_by_id is not None:
                block = blocks_by_id.get(block_id)
                if block is None or block.get("type") != "evidence":
                    raise SourceError(
                        f"{label}.design_block_id must reference an evidence block"
                    )
                expected_owner = section_id if section_id is not None else heading
                if block.get("role") != "baseline" or block.get("owner_id") != expected_owner:
                    raise SourceError(
                        f"{label}.design_block_id must reference baseline evidence owned by {expected_owner}"
                    )
        if heading in baseline_headings:
            raise SourceError(f"duplicate coverage baseline heading: {heading}")
        baseline_headings.add(heading)
    if len(references) != len(set(references)):
        raise SourceError("coverage evidence block references must be unique")


def validate_product_behavior_entries(
    value: Any,
    requirement_ids: list[str],
) -> list[str]:
    entries = require_object_array(value, "managed design product_behaviors")
    behavior_ids: list[str] = []
    for index, entry in enumerate(entries):
        label = f"product_behaviors[{index}]"
        require_object_keys(
            entry,
            {"id", "type", "change", "requirement_id"},
            label,
        )
        behavior_id = require_string(entry["id"], f"{label}.id")
        if PRODUCT_BEHAVIOR_ID_PATTERN.fullmatch(behavior_id) is None:
            raise SourceError(f"invalid product behavior ID: {behavior_id}")
        behavior_type = require_string(entry["type"], f"{label}.type")
        if behavior_type not in {"user_operation", "state_transition"}:
            raise SourceError(f"{label}.type is unsupported")
        change = require_string(entry["change"], f"{label}.change")
        if change not in {"added", "changed", "removed"}:
            raise SourceError(f"{label}.change is unsupported")
        requirement_id = require_inline_markdown(
            entry["requirement_id"], f"{label}.requirement_id"
        )
        if requirement_id not in requirement_ids:
            raise SourceError(
                f"{label}.requirement_id must reference a covered requirement"
            )
        behavior_ids.append(behavior_id)
    if behavior_ids != sorted(set(behavior_ids), key=product_behavior_sort_key):
        raise SourceError("product behavior IDs must be canonical and unique")
    return behavior_ids


def validate_repository_relative_path(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise SourceError(f"{label} must be an exact repository-relative path")
    path = value
    if "\\" in path or "*" in path or "?" in path:
        raise SourceError(f"{label} must be an exact POSIX repository-relative path")
    parsed = PurePosixPath(path)
    if parsed.is_absolute() or path != parsed.as_posix() or any(
        part in {"", ".", ".."} for part in parsed.parts
    ):
        raise SourceError(f"{label} must be a normalized repository-relative path")
    if parsed.parts[0] in {".git", ".hg", ".svn"}:
        raise SourceError(f"{label} must not target version-control metadata")
    return path


def path_is_within_scope(path: str, scope: dict[str, str]) -> bool:
    scope_path = scope["path"]
    return path == scope_path or (
        scope["kind"] == "tree" and path.startswith(f"{scope_path}/")
    )


def inventory_owned_paths(repo_root: Path, target_state: dict[str, Any]) -> list[str]:
    """Inventory regular files in the closed task-owned boundary without following links."""

    paths: list[str] = []
    for scope in target_state["ownership_scopes"]:
        relative = scope["path"]
        absolute = repo_root / relative
        if not os.path.lexists(absolute):
            continue
        if absolute.is_symlink():
            raise SourceError(f"ownership scope must not be a symlink: {relative}")
        if scope["kind"] == "file":
            if not absolute.is_file():
                raise SourceError(f"file ownership scope is not a regular file: {relative}")
            paths.append(relative)
            continue
        if not absolute.is_dir():
            raise SourceError(f"tree ownership scope is not a directory: {relative}")
        for directory, names, filenames in os.walk(absolute, followlinks=False):
            directory_path = Path(directory)
            for name in names:
                child = directory_path / name
                if child.is_symlink():
                    raise SourceError(
                        "ownership tree must not contain a symlink: "
                        f"{child.relative_to(repo_root).as_posix()}"
                    )
            for filename in filenames:
                child = directory_path / filename
                relative_child = child.relative_to(repo_root).as_posix()
                if child.is_symlink() or not child.is_file():
                    raise SourceError(
                        f"ownership tree contains a non-regular file: {relative_child}"
                    )
                paths.append(relative_child)
    return sorted(set(paths))


def validate_target_product_behaviors(
    value: Any,
    requirement_ids: list[str],
) -> list[str]:
    entries = require_object_array(value, "target_state.product_behaviors")
    ids: list[str] = []
    for index, entry in enumerate(entries):
        label = f"target_state.product_behaviors[{index}]"
        require_object_keys(entry, {"id", "type", "requirement_id"}, label)
        behavior_id = require_string(entry["id"], f"{label}.id")
        if PRODUCT_BEHAVIOR_ID_PATTERN.fullmatch(behavior_id) is None:
            raise SourceError(f"invalid product behavior ID: {behavior_id}")
        behavior_type = require_string(entry["type"], f"{label}.type")
        if behavior_type not in {"user_operation", "state_transition"}:
            raise SourceError(f"{label}.type is unsupported")
        requirement_id = require_string(entry["requirement_id"], f"{label}.requirement_id")
        if requirement_id not in requirement_ids:
            raise SourceError(f"{label}.requirement_id must reference a covered requirement")
        ids.append(behavior_id)
    if ids != sorted(set(ids), key=product_behavior_sort_key):
        raise SourceError("target product behavior IDs must be canonical and unique")
    return ids


def validate_target_state(value: Any, requirement_ids: list[str]) -> dict[str, Any]:
    target = require_object_keys(
        value,
        {
            "product_behaviors",
            "verification_cases",
            "ownership_scopes",
            "representations",
        },
        "target_state",
    )
    behavior_ids = validate_target_product_behaviors(
        target["product_behaviors"], requirement_ids
    )

    case_entries = require_object_array(
        target["verification_cases"], "target_state.verification_cases"
    )
    case_ids: list[str] = []
    case_behavior_references: list[str] = []
    case_requirements: list[str] = []
    behavior_requirements = {
        entry["id"]: entry["requirement_id"]
        for entry in target["product_behaviors"]
    }
    for index, entry in enumerate(case_entries):
        label = f"target_state.verification_cases[{index}]"
        case_type = entry.get("type")
        expected_keys = {
            "id",
            "type",
            "requirement_id",
            "product_behavior_ids",
            "command" if case_type == "automated" else "procedure",
        }
        require_object_keys(entry, expected_keys, label)
        case_id = require_string(entry["id"], f"{label}.id")
        if VERIFICATION_CASE_ID_PATTERN.fullmatch(case_id) is None:
            raise SourceError(f"invalid verification case ID: {case_id}")
        case_type = require_string(entry["type"], f"{label}.type")
        if case_type not in {"automated", "manual"}:
            raise SourceError(f"{label}.type is unsupported")
        if case_type == "automated":
            command = require_string_array(entry["command"], f"{label}.command")
            if not command:
                raise SourceError(f"{label}.command must be non-empty")
        else:
            require_inline_markdown(entry["procedure"], f"{label}.procedure")
        requirement_id = require_string(entry["requirement_id"], f"{label}.requirement_id")
        if requirement_id not in requirement_ids:
            raise SourceError(f"{label}.requirement_id must reference a covered requirement")
        references = require_string_array(
            entry["product_behavior_ids"], f"{label}.product_behavior_ids"
        )
        if references != sorted(set(references), key=product_behavior_sort_key):
            raise SourceError(f"{label}.product_behavior_ids must be canonical and unique")
        if set(references) - set(behavior_ids):
            raise SourceError(f"{label}.product_behavior_ids contains an unknown behavior")
        if any(
            behavior_requirements[behavior_id] != requirement_id
            for behavior_id in references
        ):
            raise SourceError(
                f"{label}.product_behavior_ids must share the verification case Requirement owner"
            )
        case_ids.append(case_id)
        case_requirements.append(requirement_id)
        case_behavior_references.extend(references)
    if case_ids != sorted(set(case_ids), key=verification_case_sort_key):
        raise SourceError("verification case IDs must be canonical and unique")
    if set(case_requirements) != set(requirement_ids):
        raise SourceError("verification cases must cover every Requirement ID")
    if set(case_behavior_references) != set(behavior_ids):
        raise SourceError("verification cases must cover every product behavior")

    scopes = require_object_array(
        target["ownership_scopes"], "target_state.ownership_scopes"
    )
    if not scopes:
        raise SourceError("target_state.ownership_scopes must be non-empty")
    scope_paths: list[str] = []
    forbidden_tree_roots = {"apps", "apps/web", "apps/api", "docs", ".agents", ".codex"}
    for index, scope in enumerate(scopes):
        label = f"target_state.ownership_scopes[{index}]"
        require_object_keys(scope, {"path", "kind"}, label)
        path = validate_repository_relative_path(scope["path"], f"{label}.path")
        kind = require_string(scope["kind"], f"{label}.kind")
        if kind not in {"file", "tree"}:
            raise SourceError(f"{label}.kind must be file or tree")
        if kind == "tree" and path in forbidden_tree_roots:
            raise SourceError(f"{label}.path is too broad for task-owned reconciliation")
        scope_paths.append(path)
    if scope_paths != sorted(set(scope_paths)):
        raise SourceError("ownership scopes must be unique and sorted by path")
    for index, scope in enumerate(scopes):
        for other in scopes[:index]:
            if path_is_within_scope(scope["path"], other) or path_is_within_scope(
                other["path"], scope
            ):
                raise SourceError("ownership scopes must not overlap")

    representations = require_object_array(
        target["representations"], "target_state.representations"
    )
    if not representations:
        raise SourceError("target_state.representations must be non-empty")
    representation_ids: list[str] = []
    representation_behavior_references: list[str] = []
    representation_case_references: list[str] = []
    locator_identities: list[tuple[str, str, str]] = []
    locator_kinds_by_path: dict[str, set[str]] = {}
    supported_kinds = {
        "implementation",
        "test",
        "story",
        "fixture",
        "configuration",
        "migration",
        "documentation",
    }
    case_requirements_by_id = {
        entry["id"]: entry["requirement_id"] for entry in case_entries
    }
    for index, entry in enumerate(representations):
        label = f"target_state.representations[{index}]"
        require_object_keys(
            entry,
            {
                "id",
                "kind",
                "path",
                "locator",
                "requirement_id",
                "product_behavior_ids",
                "verification_case_ids",
            },
            label,
        )
        representation_id = require_string(entry["id"], f"{label}.id")
        if REPRESENTATION_ID_PATTERN.fullmatch(representation_id) is None:
            raise SourceError(f"invalid representation ID: {representation_id}")
        kind = require_string(entry["kind"], f"{label}.kind")
        if kind not in supported_kinds:
            raise SourceError(f"{label}.kind is unsupported")
        path = validate_repository_relative_path(entry["path"], f"{label}.path")
        if not any(path_is_within_scope(path, scope) for scope in scopes):
            raise SourceError(f"{label}.path must be inside an ownership scope")
        requirement_id = require_string(entry["requirement_id"], f"{label}.requirement_id")
        if requirement_id not in requirement_ids:
            raise SourceError(f"{label}.requirement_id must reference a covered requirement")
        behavior_references = require_string_array(
            entry["product_behavior_ids"], f"{label}.product_behavior_ids"
        )
        if behavior_references != sorted(
            set(behavior_references), key=product_behavior_sort_key
        ) or set(behavior_references) - set(behavior_ids):
            raise SourceError(f"{label}.product_behavior_ids must be canonical known IDs")
        if any(
            behavior_requirements[behavior_id] != requirement_id
            for behavior_id in behavior_references
        ):
            raise SourceError(
                f"{label}.product_behavior_ids must share the representation Requirement owner"
            )
        case_references = require_string_array(
            entry["verification_case_ids"], f"{label}.verification_case_ids"
        )
        if case_references != sorted(
            set(case_references), key=verification_case_sort_key
        ) or set(case_references) - set(case_ids):
            raise SourceError(f"{label}.verification_case_ids must be canonical known IDs")
        if any(
            case_requirements_by_id[case_id] != requirement_id
            for case_id in case_references
        ):
            raise SourceError(
                f"{label}.verification_case_ids must share the representation Requirement owner"
            )
        locator = entry["locator"]
        if not isinstance(locator, dict):
            raise SourceError(f"{label}.locator must be an object")
        locator_kind = require_string(locator.get("kind"), f"{label}.locator.kind")
        if locator_kind == "file":
            require_object_keys(locator, {"kind"}, f"{label}.locator")
            locator_name = ""
        elif locator_kind in {"export", "test_case"}:
            require_object_keys(locator, {"kind", "name"}, f"{label}.locator")
            locator_name = require_inline_markdown(
                locator["name"], f"{label}.locator.name"
            )
            if (
                locator_kind == "export"
                and EXPORT_NAME_PATTERN.fullmatch(locator_name) is None
            ):
                raise SourceError(f"{label}.export locator name must be an identifier")
        else:
            raise SourceError(f"{label}.locator.kind is unsupported")
        if kind == "story" and locator_kind != "export":
            raise SourceError(f"{label}.story representation must use an export locator")
        if kind == "test" and locator_kind != "test_case":
            raise SourceError(f"{label}.test representation must use a test_case locator")
        if locator_kind == "test_case" and kind != "test":
            raise SourceError(f"{label}.test_case locator requires kind=test")
        locator_identities.append((path, locator_kind, locator_name))
        locator_kinds_by_path.setdefault(path, set()).add(locator_kind)
        representation_ids.append(representation_id)
        representation_behavior_references.extend(behavior_references)
        representation_case_references.extend(case_references)
    if representation_ids != sorted(set(representation_ids), key=representation_sort_key):
        raise SourceError("representation IDs must be canonical and unique")
    if len(locator_identities) != len(set(locator_identities)):
        raise SourceError("representation locators must be unique")
    if any(len(kinds) != 1 for kinds in locator_kinds_by_path.values()):
        raise SourceError("a representation path must use exactly one locator kind")
    if set(representation_behavior_references) != set(behavior_ids):
        raise SourceError("representations must cover every product behavior")
    if set(representation_case_references) != set(case_ids):
        raise SourceError("representations must cover every verification case")
    return target


def validate_rule_coverage_shape(value: Any, *, allow_empty_surfaces: bool = False) -> None:
    if not isinstance(value, dict) or set(value) != {
        "implementation_surfaces",
        "additional_rules",
    }:
        raise SourceError(
            "rule_coverage must contain only implementation_surfaces and additional_rules"
        )
    surfaces = value["implementation_surfaces"]
    if not isinstance(surfaces, list) or (
        not surfaces and not allow_empty_surfaces
    ):
        qualifier = "an array" if allow_empty_surfaces else "a non-empty array"
        raise SourceError(
            f"rule_coverage.implementation_surfaces must be {qualifier}"
        )
    if any(not isinstance(surface, str) or not surface.strip() for surface in surfaces):
        raise SourceError(
            "rule_coverage.implementation_surfaces must contain non-empty strings"
        )
    if len(surfaces) != len(set(surfaces)):
        raise SourceError("rule_coverage.implementation_surfaces must be unique")
    additional_rules = value["additional_rules"]
    if not isinstance(additional_rules, list):
        raise SourceError("rule_coverage.additional_rules must be an array")
    additional_ids: list[str] = []
    for index, entry in enumerate(additional_rules):
        label = f"rule_coverage.additional_rules[{index}]"
        require_object_keys(entry, {"id", "reason"}, label)
        additional_ids.append(require_string(entry["id"], f"{label}.id"))
        require_inline_markdown(entry["reason"], f"{label}.reason")
    if len(additional_ids) != len(set(additional_ids)):
        raise SourceError("rule_coverage.additional_rules IDs must be unique")


def validate_product_behaviors(
    value: Any,
    requirement_ids: list[str],
    blocks_by_id: dict[str, dict[str, Any]],
) -> None:
    behavior_ids = validate_product_behavior_entries(value, requirement_ids)

    references: list[str] = []
    owners: dict[str, str] = {}
    for block in blocks_by_id.values():
        if block.get("type") == "evidence" and block.get("role") == "design":
            references.extend(block["product_behavior_ids"])
            owners.update(
                {
                    behavior_id: block["owner_id"]
                    for behavior_id in block["product_behavior_ids"]
                }
            )
    if len(references) != len(set(references)):
        raise SourceError("each product behavior must have one design evidence owner")
    if sorted(references, key=product_behavior_sort_key) != behavior_ids:
        raise SourceError(
            "design evidence product behavior references must exactly own the inventory"
        )
    for entry in value:
        if owners[entry["id"]] != entry["requirement_id"]:
            raise SourceError(
                f"product behavior {entry['id']} design evidence owner must equal requirement ID"
            )


def validate_target_behavior_ownership(
    target_state: dict[str, Any],
    blocks_by_id: dict[str, dict[str, Any]],
) -> None:
    behaviors = target_state["product_behaviors"]
    behavior_ids = [entry["id"] for entry in behaviors]
    references: list[str] = []
    owners: dict[str, str] = {}
    for block in blocks_by_id.values():
        if block.get("type") == "evidence" and block.get("role") == "design":
            for behavior_id in block["product_behavior_ids"]:
                references.append(behavior_id)
                owners[behavior_id] = block["owner_id"]
    if len(references) != len(set(references)):
        raise SourceError("each target product behavior must have one design evidence owner")
    if sorted(references, key=product_behavior_sort_key) != behavior_ids:
        raise SourceError("design evidence must exactly own the target product behaviors")
    for entry in behaviors:
        if owners[entry["id"]] != entry["requirement_id"]:
            raise SourceError(
                f"product behavior {entry['id']} design evidence owner must equal requirement ID"
            )


def validate_managed_artifact_source(value: Any) -> dict[str, Any]:
    source = validate_source(value)
    kind = source["kind"]
    if kind not in ARTIFACT_KINDS:
        raise SourceError("managed artifact validation requires an artifact source")
    validation = source["validation"]
    if validation.get("mode") != "managed":
        raise SourceError("managed artifact validation requires validation.mode=managed")
    version = source["schema_version"]
    valid_keys = (
        MANAGED_V3_VALIDATION_KEYS[kind]
        if version == SCHEMA_VERSION
        else MANAGED_VALIDATION_KEYS[kind]
    )
    legacy_design_keys = valid_keys - {"rule_coverage"}
    if set(validation) != valid_keys and not (
        kind == "design"
        and version == LEGACY_SCHEMA_VERSION
        and set(validation) == legacy_design_keys
    ):
        raise SourceError(f"managed {kind} validation has invalid keys")
    sections, sections_by_id, blocks_by_id = validate_v2_sections(
        validation["sections"], kind
    )
    if kind == "requirements":
        require_inline_markdown(
            validation["cycle_start_issue_title"],
            "validation.cycle_start_issue_title",
        )
        validate_requirements_input_gate(validation["input_gate"])
        validate_requirements_completeness_gate(validation["completeness_gate"])
        requirements = validate_v2_requirements(
            validation["requirements"], sections_by_id
        )
        gate_ids = [
            entry["id"] for entry in validation["completeness_gate"]["requirements"]
        ]
        if gate_ids != [entry["id"] for entry in requirements]:
            raise SourceError(
                "completeness_gate requirement IDs must exactly match requirements"
            )
        gate_section_ids = [
            entry["id"] for entry in validation["completeness_gate"]["sections"]
        ]
        if gate_section_ids != [entry["id"] for entry in sections]:
            raise SourceError(
                "completeness_gate section IDs must exactly match sections"
            )
        gate_workspace = validation["completeness_gate"]["workspace"]
    else:
        validate_design_coverage_gate(validation["coverage_gate"], blocks_by_id)
        if "rule_coverage" in validation:
            validate_rule_coverage_shape(
                validation["rule_coverage"],
                allow_empty_surfaces=version == SCHEMA_VERSION,
            )
        if version == SCHEMA_VERSION:
            target_state = validate_target_state(
                validation["target_state"],
                validation["coverage_gate"]["requirement_ids"],
            )
            validate_target_behavior_ownership(target_state, blocks_by_id)
        else:
            validate_product_behaviors(
                validation["product_behaviors"],
                validation["coverage_gate"]["requirement_ids"],
                blocks_by_id,
            )
        gate_workspace = validation["coverage_gate"]["workspace"]
    if gate_workspace != source["workspace"]:
        raise SourceError("Gate workspace must match source.workspace")
    return source


def validate_managed_goal_source(value: Any) -> dict[str, Any]:
    source = validate_source(value)
    kind = source["kind"]
    if kind not in GOAL_KINDS:
        raise SourceError("managed Goal validation requires a Goal source")
    validation = source["validation"]
    if validation.get("mode") != "managed":
        raise SourceError("Goal validation.mode must be managed")
    version = source["schema_version"]
    valid_keys = (
        MANAGED_V3_GOAL_VALIDATION_KEYS[kind]
        if version == SCHEMA_VERSION
        else MANAGED_GOAL_VALIDATION_KEYS[kind]
    )
    legacy_design_goal_keys = valid_keys - {"rule_coverage"}
    if set(validation) != valid_keys and not (
        kind == "design_goal"
        and version == LEGACY_SCHEMA_VERSION
        and set(validation) == legacy_design_goal_keys
    ):
        raise SourceError(f"managed {kind} validation has invalid keys")
    if kind == "requirements_goal":
        require_inline_markdown(
            validation["cycle_start_issue_title"],
            "validation.cycle_start_issue_title",
        )
        validate_requirements_input_gate(validation["input_gate"])
        validate_requirements_completeness_gate(validation["completeness_gate"])
        entries = require_object_array(validation["requirements"], "Goal requirements")
        ids: list[str] = []
        for index, entry in enumerate(entries):
            require_object_keys(entry, {"id", "text"}, f"requirements[{index}]")
            requirement_id = require_string(entry["id"], f"requirements[{index}].id")
            require_inline_markdown(entry["text"], f"requirements[{index}].text")
            ids.append(requirement_id)
        if ids != sorted(set(ids), key=requirement_sort_key):
            raise SourceError("Goal requirement IDs must be unique and canonical")
        gate_ids = [
            entry["id"] for entry in validation["completeness_gate"]["requirements"]
        ]
        if gate_ids != ids:
            raise SourceError("Goal gate IDs must exactly match requirements")
        gate_workspace = validation["completeness_gate"]["workspace"]
    else:
        validate_design_goal_coverage_gate(validation["coverage_gate"])
        if "rule_coverage" in validation:
            validate_rule_coverage_shape(
                validation["rule_coverage"],
                allow_empty_surfaces=version == SCHEMA_VERSION,
            )
        if version == SCHEMA_VERSION:
            validate_target_state(
                validation["target_state"],
                validation["coverage_gate"]["requirement_ids"],
            )
        else:
            validate_product_behavior_entries(
                validation["product_behaviors"],
                validation["coverage_gate"]["requirement_ids"],
            )
        scope_ids: list[str] = []
        for index, entry in enumerate(
            require_object_array(validation["scopes"], "design_goal scopes")
        ):
            require_object_keys(
                entry,
                {"id", "design_scope", "verification_scope"},
                f"scopes[{index}]",
            )
            for field in ("id", "design_scope", "verification_scope"):
                require_inline_markdown(entry[field], f"scopes[{index}].{field}")
            scope_ids.append(entry["id"])
        if scope_ids != validation["coverage_gate"]["requirement_ids"]:
            raise SourceError("Goal scope IDs must exactly match requirement_ids")
        for index, entry in enumerate(
            require_object_array(validation["baseline_scopes"], "baseline_scopes")
        ):
            require_object_keys(
                entry,
                {"section_id", "heading", "review_scope"},
                f"baseline_scopes[{index}]",
            )
            section_id = entry["section_id"]
            if section_id is not None:
                require_string(section_id, f"baseline_scopes[{index}].section_id")
                if BLOCK_ID_PATTERN.fullmatch(section_id) is None:
                    raise SourceError(
                        f"baseline_scopes[{index}].section_id must use lowercase ASCII kebab-case"
                    )
            require_inline_markdown(
                entry["heading"], f"baseline_scopes[{index}].heading"
            )
            require_inline_markdown(
                entry["review_scope"], f"baseline_scopes[{index}].review_scope"
            )
        gate_workspace = validation["coverage_gate"]["workspace"]
    if gate_workspace != source["workspace"]:
        raise SourceError("Goal Gate workspace must match source.workspace")
    return source


def validate_loaded_source(
    value: Any,
    expected_kind: str | None = None,
) -> dict[str, Any]:
    source = validate_source(value, expected_kind)
    mode = source["validation"].get("mode")
    if source["kind"] in ARTIFACT_KINDS:
        if mode != "managed":
            raise SourceError("artifact validation.mode must be managed")
        return validate_managed_artifact_source(source)
    if mode != "managed":
        raise SourceError("Goal validation.mode must be managed")
    return validate_managed_goal_source(source)


def reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise SourceError(f"AIDD source JSON contains duplicate key: {key}")
        value[key] = item
    return value


def reject_non_json_constant(value: str) -> None:
    raise SourceError(f"AIDD source JSON contains non-JSON constant: {value}")


def decode_source_json(content: str) -> Any:
    try:
        return json.loads(
            content,
            object_pairs_hook=reject_duplicate_keys,
            parse_constant=reject_non_json_constant,
        )
    except json.JSONDecodeError as error:
        raise SourceError(f"AIDD source JSON is invalid: {error}") from error


def load_source(path: Path, expected_kind: str | None = None) -> dict[str, Any]:
    return load_source_bytes(read_regular_file_bytes(path), expected_kind)


def read_regular_file_bytes(path: Path) -> bytes:
    """Read a bounded regular file without following its final symlink."""

    absolute_path = Path(os.path.abspath(path))
    directory_fd = open_directory_without_symlinks(absolute_path.parent)
    flags = os.O_RDONLY | getattr(os, "O_NONBLOCK", 0)
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(absolute_path.name, flags, dir_fd=directory_fd)
    finally:
        os.close(directory_fd)
    with os.fdopen(descriptor, "rb") as source:
        if not stat.S_ISREG(os.fstat(source.fileno()).st_mode):
            raise SourceError(f"AIDD source must be a regular file: {path}")
        content = source.read(MAX_SOURCE_BYTES + 1)
    if len(content) > MAX_SOURCE_BYTES:
        raise SourceError(f"AIDD source exceeds {MAX_SOURCE_BYTES} bytes: {path}")
    return content


def open_directory_without_symlinks(
    directory: Path,
    *,
    create: bool = False,
) -> int:
    """Open an absolute directory one no-follow component at a time."""

    if not directory.is_absolute():
        raise SourceError("atomic write directory must be absolute")
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    current_fd = os.open(os.sep, flags)
    try:
        for component in directory.parts[1:]:
            try:
                next_fd = os.open(component, flags, dir_fd=current_fd)
            except FileNotFoundError:
                if not create:
                    raise
                os.mkdir(component, dir_fd=current_fd)
                next_fd = os.open(component, flags, dir_fd=current_fd)
            os.close(current_fd)
            current_fd = next_fd
        return current_fd
    except Exception:
        os.close(current_fd)
        raise


def write_regular_file_atomically(path: Path, content: str) -> None:
    """Replace a regular text file without following path symlinks."""

    directory_fd = open_directory_without_symlinks(path.parent, create=True)
    temporary_name = f".{path.name}.tmp-{secrets.token_hex(8)}"
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    temporary_fd: int | None = None
    try:
        temporary_fd = os.open(temporary_name, flags, 0o666, dir_fd=directory_fd)
        with os.fdopen(temporary_fd, "w", encoding="utf-8", newline="") as output:
            temporary_fd = None
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.replace(
            temporary_name,
            path.name,
            src_dir_fd=directory_fd,
            dst_dir_fd=directory_fd,
        )
        os.fsync(directory_fd)
    finally:
        if temporary_fd is not None:
            os.close(temporary_fd)
        try:
            os.unlink(temporary_name, dir_fd=directory_fd)
        except FileNotFoundError:
            pass
        os.close(directory_fd)


def load_regular_source(
    path: Path,
    expected_kind: str | None = None,
) -> dict[str, Any]:
    return load_source_bytes(read_regular_file_bytes(path), expected_kind)


def load_source_bytes(
    content: bytes,
    expected_kind: str | None = None,
) -> dict[str, Any]:
    try:
        decoded = content.decode("utf-8")
    except UnicodeDecodeError as error:
        raise SourceError(f"AIDD source JSON is invalid: {error}") from error
    value = decode_source_json(decoded)
    return validate_loaded_source(value, expected_kind)


def serialize_source(value: dict[str, Any]) -> str:
    validate_loaded_source(value)
    serialized = f"{json.dumps(value, ensure_ascii=False, indent=2)}\n"
    if len(serialized.encode("utf-8")) > MAX_SOURCE_BYTES:
        raise SourceError(f"serialized AIDD source exceeds {MAX_SOURCE_BYTES} bytes")
    return serialized
