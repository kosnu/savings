"""Load and validate structured AIDD Goal and artifact sources."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 1
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
WORKSPACE_PATTERN = re.compile(r"[a-z0-9][a-z0-9-]*")


class SourceError(ValueError):
    pass


def require_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise SourceError(f"{label} must be a non-empty string")
    return value


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
    if not isinstance(value, dict) or set(value) != {
        "schema_version",
        "kind",
        "workspace",
        "display",
        "validation",
    }:
        raise SourceError(
            "AIDD source must contain only schema_version, kind, workspace, "
            "display, and validation"
        )
    if value["schema_version"] != SCHEMA_VERSION:
        raise SourceError(f"unsupported AIDD schema_version: {value['schema_version']}")
    kind = require_string(value["kind"], "kind")
    if kind not in SUPPORTED_KINDS:
        raise SourceError(f"unsupported AIDD source kind: {kind}")
    if expected_kind is not None and kind != expected_kind:
        raise SourceError(f"AIDD source kind must be {expected_kind}")
    workspace = require_string(value["workspace"], "workspace")
    validate_workspace_name(workspace)

    display = value["display"]
    if not isinstance(display, dict) or set(display) != {"path", "markdown"}:
        raise SourceError("display must contain only path and markdown")
    display_path = require_string(display["path"], "display.path")
    if display_path != DISPLAY_FILENAMES[kind]:
        raise SourceError(
            f"display.path must be {DISPLAY_FILENAMES[kind]} for {kind}"
        )
    if not isinstance(display["markdown"], str):
        raise SourceError("display.markdown must be a string")
    if not isinstance(value["validation"], dict):
        raise SourceError("validation must be an object")
    return value


def load_source(path: Path, expected_kind: str | None = None) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise SourceError(f"AIDD source JSON is invalid: {error}") from error
    return validate_source(value, expected_kind)


def load_source_bytes(
    content: bytes,
    expected_kind: str | None = None,
) -> dict[str, Any]:
    try:
        value = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise SourceError(f"AIDD source JSON is invalid: {error}") from error
    return validate_source(value, expected_kind)


def serialize_source(value: dict[str, Any]) -> str:
    validate_source(value)
    return f"{json.dumps(value, ensure_ascii=False, indent=2)}\n"
