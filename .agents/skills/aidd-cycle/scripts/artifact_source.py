"""Load and validate structured AIDD Goal and artifact sources."""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import stat
import unicodedata
from pathlib import Path
from typing import Any

LEGACY_SCHEMA_VERSION = 1
SCHEMA_VERSION = 2
ARTIFACT_KINDS = {"requirements", "design"}
GOAL_KINDS = {"requirements_goal", "design_goal"}
SUPPORTED_KINDS = ARTIFACT_KINDS | GOAL_KINDS
SOURCE_FILENAMES = {
    "requirements": "requirements.json",
    "design": "design.json",
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
        "input_gate",
        "completeness_gate",
        "requirements",
        "sections",
    },
    "design": {"mode", "coverage_gate", "sections"},
}
LEGACY_VALIDATION_KEYS = {
    "requirements": {
        "mode",
        "source_markdown_sha256",
        "inventory_sha256",
        "requirements",
        "sections",
    },
    "design": {"mode", "source_markdown_sha256", "inventory_sha256", "sections"},
}
MANAGED_GOAL_VALIDATION_KEYS = {
    "requirements_goal": {
        "mode",
        "input_gate",
        "completeness_gate",
        "requirements",
    },
    "design_goal": {"mode", "coverage_gate", "scopes", "baseline_scopes"},
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
REQUIREMENT_PREFIX_ORDER = {"FR": 0, "NFR": 1, "AC": 2}
WORKSPACE_PATTERN = re.compile(r"[a-z0-9][a-z0-9-]*")
DIGEST_PATTERN = re.compile(r"[0-9a-f]{64}")
MAX_SOURCE_BYTES = 16 * 1024 * 1024
EVIDENCE_ROLES = {"design", "verification", "baseline"}
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


def structured_sha256(value: Any) -> str:
    serialized = json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
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


def is_placeholder_text(value: str) -> bool:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    canonical = "".join(
        character
        for character in normalized
        if unicodedata.category(character)[0] not in {"P", "S", "Z", "C", "M"}
    )
    return not canonical or canonical in EVIDENCE_PLACEHOLDERS


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
    if type(version) is not int or version not in {
        LEGACY_SCHEMA_VERSION,
        SCHEMA_VERSION,
    }:
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
    if version == LEGACY_SCHEMA_VERSION:
        require_object_keys(display, {"path", "markdown"}, "legacy display")
        if kind not in ARTIFACT_KINDS:
            raise SourceError("schema_version 1 is only supported for legacy artifacts")
        if validation.get("mode") != "legacy_import":
            raise SourceError("schema_version 1 is only supported for legacy_import")
        require_string(display["markdown"], "legacy display.markdown")
    elif kind in ARTIFACT_KINDS:
        require_object_keys(display, {"path", "preamble"}, "managed display")
        require_string(display["preamble"], "managed display.preamble")
    else:
        require_object_keys(
            display,
            {"path", "title", "goal", "context", "done"},
            "managed Goal display",
        )
        require_inline_markdown(display["title"], "display.title")
        require_inline_markdown(display["goal"], "display.goal")
        context = require_object_keys(
            display["context"],
            {"body", "constraints", "stop"},
            "display.context",
        )
        require_string_array(context["body"], "display.context.body")
        require_string_array(
            context["constraints"], "display.context.constraints"
        )
        require_string_array(context["stop"], "display.context.stop")
        require_string_array(display["done"], "display.done")
        for field, entries in (
            ("display.context.body", context["body"]),
            ("display.context.constraints", context["constraints"]),
            ("display.context.stop", context["stop"]),
            ("display.done", display["done"]),
        ):
            if not entries:
                raise SourceError(f"{field} must be non-empty")
            for index, entry in enumerate(entries):
                require_inline_markdown(entry, f"{field}[{index}]")

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
            require_object_keys(
                block,
                {"id", "type", "role", "owner_id", "text"},
                block_label,
            )
            role = require_string(block["role"], f"{block_label}.role")
            if role not in EVIDENCE_ROLES:
                raise SourceError(f"{block_label}.role is unsupported")
            require_inline_markdown(block["owner_id"], f"{block_label}.owner_id")
            require_evidence_text(block["text"], f"{block_label}.text")
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
        require_object_keys(
            entry,
            {
                "section_id",
                "heading",
                "content_sha256",
                "status",
                "design_block_id",
            },
            label,
        )
        section_id = entry["section_id"]
        if section_id is not None:
            require_string(section_id, f"{label}.section_id")
            if BLOCK_ID_PATTERN.fullmatch(section_id) is None:
                raise SourceError(
                    f"{label}.section_id must use lowercase ASCII kebab-case"
                )
        heading = require_string(entry["heading"], f"{label}.heading")
        require_digest(entry["content_sha256"], f"{label}.content_sha256")
        require_string(entry["status"], f"{label}.status")
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


def validate_managed_artifact_source(value: Any) -> dict[str, Any]:
    source = validate_source(value)
    if source["schema_version"] != SCHEMA_VERSION:
        raise SourceError("managed artifacts require schema_version 2")
    kind = source["kind"]
    if kind not in ARTIFACT_KINDS:
        raise SourceError("managed artifact validation requires an artifact source")
    validation = source["validation"]
    if validation.get("mode") != "managed":
        raise SourceError("managed artifact validation requires validation.mode=managed")
    if set(validation) != MANAGED_VALIDATION_KEYS[kind]:
        raise SourceError(f"managed {kind} validation has invalid keys")
    sections, sections_by_id, blocks_by_id = validate_v2_sections(
        validation["sections"], kind
    )
    if kind == "requirements":
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
        gate_workspace = validation["coverage_gate"]["workspace"]
    if gate_workspace != source["workspace"]:
        raise SourceError("Gate workspace must match source.workspace")
    return source


def validate_legacy_artifact_source(value: Any) -> dict[str, Any]:
    source = validate_source(value)
    if source["schema_version"] != LEGACY_SCHEMA_VERSION:
        raise SourceError("legacy artifacts require schema_version 1")
    kind = source["kind"]
    validation = source["validation"]
    if set(validation) != LEGACY_VALIDATION_KEYS[kind]:
        raise SourceError(f"legacy {kind} validation has invalid keys")
    digest = require_digest(
        validation["source_markdown_sha256"],
        f"legacy {kind} source_markdown_sha256",
    )
    markdown = source["display"]["markdown"]
    if digest != hashlib.sha256(markdown.encode("utf-8")).hexdigest():
        raise SourceError("legacy source Markdown digest mismatch")
    inventory = {"sections": validation["sections"]}
    if kind == "requirements":
        inventory["requirements"] = validation["requirements"]
    if require_digest(
        validation["inventory_sha256"], "legacy inventory_sha256"
    ) != structured_sha256(inventory):
        raise SourceError(f"legacy {kind} inventory mismatch")
    require_object_array(validation["sections"], f"legacy {kind} sections")
    if kind == "requirements":
        require_object_array(validation["requirements"], "legacy requirements")
    return source


def validate_managed_goal_source(value: Any) -> dict[str, Any]:
    source = validate_source(value)
    if source["schema_version"] != SCHEMA_VERSION:
        raise SourceError("managed Goals require schema_version 2")
    kind = source["kind"]
    if kind not in GOAL_KINDS:
        raise SourceError("managed Goal validation requires a Goal source")
    validation = source["validation"]
    if validation.get("mode") != "managed":
        raise SourceError("Goal validation.mode must be managed")
    if set(validation) != MANAGED_GOAL_VALIDATION_KEYS[kind]:
        raise SourceError(f"managed {kind} validation has invalid keys")
    if kind == "requirements_goal":
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
        if mode == "managed":
            return validate_managed_artifact_source(source)
        if mode == "legacy_import":
            return validate_legacy_artifact_source(source)
        raise SourceError("artifact validation.mode must be managed or legacy_import")
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


def load_baseline_source_bytes(
    content: bytes,
    expected_kind: str,
) -> dict[str, Any]:
    """Load Git HEAD source without reinterpreting its Markdown display."""

    try:
        decoded = content.decode("utf-8")
    except UnicodeDecodeError as error:
        raise SourceError(f"AIDD source JSON is invalid: {error}") from error
    value = decode_source_json(decoded)
    if (
        isinstance(value, dict)
        and value.get("schema_version") == LEGACY_SCHEMA_VERSION
        and isinstance(value.get("validation"), dict)
        and value["validation"].get("mode") == "managed"
    ):
        require_object_keys(
            value,
            {"schema_version", "kind", "workspace", "display", "validation"},
            "legacy managed Git baseline",
        )
        if value["kind"] != expected_kind:
            raise SourceError(f"AIDD source kind must be {expected_kind}")
        validate_workspace_name(
            require_string(value["workspace"], "legacy managed workspace")
        )
        display = require_object_keys(
            value["display"], {"path", "markdown"}, "legacy managed display"
        )
        if display["path"] != DISPLAY_FILENAMES[expected_kind]:
            raise SourceError("legacy managed display path mismatch")
        markdown = require_string(display["markdown"], "legacy managed Markdown")
        validation = value["validation"]
        expected_keys = MANAGED_VALIDATION_KEYS[expected_kind] | {
            "source_markdown_sha256"
        }
        require_object_keys(validation, expected_keys, "legacy managed validation")
        digest = require_digest(
            validation["source_markdown_sha256"],
            "legacy managed source_markdown_sha256",
        )
        if digest != hashlib.sha256(markdown.encode("utf-8")).hexdigest():
            raise SourceError("legacy managed Git baseline Markdown digest mismatch")
        return value
    return validate_loaded_source(value, expected_kind)


def serialize_source(value: dict[str, Any]) -> str:
    validate_loaded_source(value)
    serialized = f"{json.dumps(value, ensure_ascii=False, indent=2)}\n"
    if len(serialized.encode("utf-8")) > MAX_SOURCE_BYTES:
        raise SourceError(f"serialized AIDD source exceeds {MAX_SOURCE_BYTES} bytes")
    return serialized
