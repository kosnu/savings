#!/usr/bin/env python3
"""Import existing AIDD Markdown once and verify structured sidecars."""

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
    canonical_source_path,
    load_source,
    normalize_markdown_newlines,
    serialize_source,
)
from requirement_ids import (
    REQUIRED_REQUIREMENTS_SECTIONS,
    extract_level_two_sections,
    extract_required_requirements_sections,
    extract_requirement_items,
    requirement_sort_key,
)


GATE_PATTERNS = {
    "input_gate": re.compile(
        r"(?ms)^## Requirements Input Gate\s*$.*?```json\s*\n(.*?)\n```"
    ),
    "completeness_gate": re.compile(
        r"(?ms)^## Requirements Completeness Gate\s*$.*?```json\s*\n(.*?)\n```"
    ),
    "coverage_gate": re.compile(
        r"(?ms)^## Design Coverage Gate\s*$.*?```json\s*\n(.*?)\n```"
    ),
}
GOAL_SCOPE_PATTERN = re.compile(
    r"(?m)^-\s+((?:FR|NFR|AC)-[1-9][0-9]*) "
    r"(design|verification) scope:\s*(.+)$"
)
BASELINE_SCOPE_PATTERN = re.compile(
    r"(?m)^-\s+(.+?) baseline scope:\s*(.+)$"
)


def parse_gate(markdown: str, name: str) -> dict[str, Any] | None:
    match = GATE_PATTERNS[name].search(markdown)
    if match is None:
        return None
    value = json.loads(match.group(1))
    if not isinstance(value, dict):
        raise SourceError(f"{name} must contain a JSON object")
    return value


def requirements_inventory(markdown: str) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    items = extract_requirement_items(markdown)
    sections = extract_required_requirements_sections(markdown, require_all=False)
    return (
        [
            {"id": requirement_id, "content": items[requirement_id].content}
            for requirement_id in sorted(items, key=requirement_sort_key)
        ],
        [
            {
                "id": section_id,
                "heading": sections[section_id].heading,
                "content": sections[section_id].content,
            }
            for section_id in REQUIRED_REQUIREMENTS_SECTIONS
            if section_id in sections
        ],
    )


def design_inventory(markdown: str) -> list[dict[str, str]]:
    return [
        {"heading": section.heading, "content": section.content}
        for section in extract_level_two_sections(markdown)
    ]


def build_source(workspace: str, kind: str, markdown: str) -> dict[str, Any]:
    markdown = normalize_markdown_newlines(markdown)
    digest = hashlib.sha256(markdown.encode("utf-8")).hexdigest()
    if kind == "requirements":
        requirements, sections = requirements_inventory(markdown)
        input_gate = parse_gate(markdown, "input_gate")
        completeness_gate = parse_gate(markdown, "completeness_gate")
        managed = input_gate is not None and completeness_gate is not None
        validation: dict[str, Any] = {
            "mode": "managed" if managed else "legacy_import",
            "source_markdown_sha256": digest,
            "requirements": requirements,
            "sections": sections,
        }
        if managed:
            validation["input_gate"] = input_gate
            validation["completeness_gate"] = completeness_gate
    else:
        coverage_gate = parse_gate(markdown, "coverage_gate")
        validation = {
            "mode": "managed" if coverage_gate is not None else "legacy_import",
            "source_markdown_sha256": digest,
            "sections": design_inventory(markdown),
        }
        if coverage_gate is not None:
            validation["coverage_gate"] = coverage_gate

    return {
        "schema_version": 1,
        "kind": kind,
        "workspace": workspace,
        "display": {
            "path": "requirements.md" if kind == "requirements" else "design-doc.md",
            "markdown": markdown,
        },
        "validation": validation,
    }


def build_goal_source(workspace: str, kind: str, markdown: str) -> dict[str, Any]:
    markdown = normalize_markdown_newlines(markdown)
    if kind == "requirements":
        input_gate = parse_gate(markdown, "input_gate")
        completeness_gate = parse_gate(markdown, "completeness_gate")
        if input_gate is None or completeness_gate is None:
            raise SourceError("Requirements Goal gates are missing")
        requirements, _ = requirements_inventory(markdown)
        validation = {
            "mode": "managed",
            "input_gate": input_gate,
            "completeness_gate": completeness_gate,
            "requirements": requirements,
        }
        source_kind = "requirements_goal"
    else:
        coverage_gate = parse_gate(markdown, "coverage_gate")
        if coverage_gate is None:
            raise SourceError("Design Goal coverage gate is missing")
        scopes_by_id: dict[str, dict[str, str]] = {}
        for requirement_id, scope_kind, text in GOAL_SCOPE_PATTERN.findall(markdown):
            entry = scopes_by_id.setdefault(requirement_id, {"id": requirement_id})
            entry[f"{scope_kind}_scope"] = (
                f"{requirement_id} {scope_kind} scope: {text}"
            )
        expected_ids = coverage_gate.get("requirement_ids")
        if not isinstance(expected_ids, list):
            raise SourceError("Design Goal requirement_ids are missing")
        scopes = [scopes_by_id.get(requirement_id) for requirement_id in expected_ids]
        if any(
            not isinstance(entry, dict)
            or set(entry) != {"id", "design_scope", "verification_scope"}
            for entry in scopes
        ):
            raise SourceError("Design Goal scopes are incomplete")
        baseline_scopes = [
            {
                "heading": heading.strip(),
                "review_scope": f"{heading.strip()} baseline scope: {text}",
            }
            for heading, text in BASELINE_SCOPE_PATTERN.findall(markdown)
        ]
        validation = {
            "mode": "managed",
            "coverage_gate": coverage_gate,
            "scopes": scopes,
            "baseline_scopes": baseline_scopes,
        }
        source_kind = "design_goal"
    return {
        "schema_version": 1,
        "kind": source_kind,
        "workspace": workspace,
        "display": {"path": "goal.md", "markdown": markdown},
        "validation": validation,
    }


def expected_pairs(repo_root: Path) -> list[tuple[Path, Path, str]]:
    root = repo_root / "docs" / "ai-driven-development" / "workspaces"
    pairs: list[tuple[Path, Path, str]] = []
    for workspace_dir in sorted(path for path in root.iterdir() if path.is_dir()):
        for kind, display_name in (
            ("requirements", "requirements.md"),
            ("design", "design-doc.md"),
        ):
            display_path = workspace_dir / display_name
            if display_path.is_file():
                pairs.append(
                    (
                        display_path,
                        canonical_source_path(repo_root, workspace_dir.name, kind),
                        kind,
                    )
                )
    return pairs


def migrate(repo_root: Path, write: bool) -> int:
    checked = 0
    for display_path, source_path, kind in expected_pairs(repo_root):
        markdown = normalize_markdown_newlines(
            display_path.read_bytes().decode("utf-8")
        )
        expected = build_source(display_path.parent.name, kind, markdown)
        existing = load_source(source_path, kind) if source_path.is_file() else None
        preserves_managed_source = (
            existing is not None
            and existing["validation"].get("mode") == "managed"
        )
        if write and not preserves_managed_source:
            source_path.write_text(serialize_source(expected), encoding="utf-8")
        source = load_source(source_path, kind)
        if source["workspace"] != display_path.parent.name:
            raise SourceError(f"workspace mismatch: {source_path}")
        if normalize_markdown_newlines(source["display"]["markdown"]) != markdown:
            raise SourceError(f"Markdown round-trip mismatch: {display_path}")
        if source["validation"].get("source_markdown_sha256") != hashlib.sha256(
            markdown.encode("utf-8")
        ).hexdigest():
            raise SourceError(f"Markdown digest mismatch: {source_path}")
        if (
            expected["validation"].get("mode") == "legacy_import"
            and source != expected
        ):
            raise SourceError(f"legacy import differs from migration model: {source_path}")
        checked += 1
    print(f"AIDD migration {'wrote' if write else 'check passed'}: {checked} artifacts")
    return checked


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--import-goal", choices=("requirements", "design"))
    parser.add_argument("--goal-markdown", type=Path)
    parser.add_argument("--workspace")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        if args.import_goal:
            if args.goal_markdown is None or args.workspace is None or args.output is None:
                raise SourceError(
                    "--import-goal requires --goal-markdown, --workspace, and --output"
                )
            source = build_goal_source(
                args.workspace,
                args.import_goal,
                args.goal_markdown.read_text(encoding="utf-8"),
            )
            args.output.write_text(serialize_source(source), encoding="utf-8")
            print(f"AIDD Goal migration wrote: {args.output}")
            return 0
        migrate(args.repo_root.resolve(), args.write)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError, SourceError) as error:
        print(f"AIDD migration failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
