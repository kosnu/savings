#!/usr/bin/env python3
"""Render or check human-readable Markdown from structured AIDD sources."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

from artifact_source import (
    ARTIFACT_KINDS,
    DISPLAY_FILENAMES,
    GOAL_KINDS,
    SOURCE_FILENAMES,
    SourceError,
    canonical_display_path,
    canonical_source_path,
    load_source,
    normalize_markdown_newlines,
)
from git_baseline import GitBaselineError, require_repository_root, run_git
from structured_ids import (
    extract_requirement_mentions,
    requirement_section_ids_for_heading,
    requirement_sort_key,
)


GOAL_REQUIRED_MARKERS = (
    ("## Goal", r"^## Goal[ \t]*$"),
    ("## Context Packet", r"^## Context Packet[ \t]*$"),
    ("- Constraints:", r"^- Constraints:[ \t]*\S.+$"),
    ("- Stop:", r"^- Stop:[ \t]*\S.+$"),
    ("## Done / Verification", r"^## Done / Verification[ \t]*$"),
)
GOAL_GATE_FIELDS = {
    "requirements_goal": (
        ("Requirements Input Gate", "input_gate"),
        ("Requirements Completeness Gate", "completeness_gate"),
    ),
    "design_goal": (("Design Coverage Gate", "coverage_gate"),),
}
GOAL_SCOPE_FIELDS = {
    "requirements_goal": (("requirements", ("content",)),),
    "design_goal": (
        ("scopes", ("design_scope", "verification_scope")),
        ("baseline_scopes", ("review_scope",)),
    ),
}
NARROW_GOAL_SCOPE_PATTERN = re.compile(
    r"(?:差分|変更|追加|指摘).{0,6}(?:だけ|のみ|限定)"
    r"(?![^。\n]{0,8}(?:扱わない|対象としない|限定しない|狭めない))"
    r"|(?:only|limited to)\s+(?:the\s+)?"
    r"(?:delta|change|changes|addition|review comments?)",
    re.IGNORECASE,
)
VALIDATED_SCOPE_PREFIX = "- Validated Scope:"
REQUIREMENT_SECTION_BY_PREFIX = {
    "FR": "functional",
    "NFR": "non_functional",
    "AC": "acceptance",
}
REQUIREMENT_DEFINITION_LINE_PATTERN = re.compile(
    r"^[ \t]{0,3}(?:#{2,6}|[-*+])[ \t]+(?:\*\*)?"
    r"(?P<id>(?:FR|NFR|AC)-[1-9][0-9]*)"
    r"(?![A-Za-z0-9_-])"
)


def normalized_path(path: Path) -> Path:
    return Path(os.path.abspath(path))


def require_git_worktree_root(repo_root: Path) -> Path:
    absolute_root = normalized_path(repo_root)
    try:
        resolved_root = require_repository_root(absolute_root)
    except GitBaselineError as error:
        raise SourceError(str(error)) from error
    if absolute_root != resolved_root:
        raise SourceError("repo-root must not contain symlinks")
    return resolved_root


def require_no_symlinks(repo_root: Path, path: Path, label: str) -> None:
    current_path = repo_root
    for part in normalized_path(path).relative_to(repo_root).parts:
        current_path /= part
        if current_path.is_symlink():
            raise SourceError(f"{label} canonical path must not contain symlinks")


def require_canonical_artifact_paths(
    repo_root: Path,
    source_path: Path,
    output_path: Path,
    source: dict[str, object],
) -> None:
    kind = source["kind"]
    workspace = source["workspace"]
    if not isinstance(kind, str) or not isinstance(workspace, str):
        raise SourceError("artifact source kind and workspace must be strings")
    expected_source = canonical_source_path(repo_root, workspace, kind)
    expected_output = canonical_display_path(repo_root, workspace, kind)
    if normalized_path(source_path) != expected_source:
        raise SourceError(f"artifact source must be canonical: {expected_source}")
    if normalized_path(output_path) != expected_output:
        raise SourceError(f"artifact output must be canonical: {expected_output}")
    require_no_symlinks(repo_root, expected_source, "artifact source")
    require_no_symlinks(repo_root, expected_output, "artifact output")


def extract_goal_gate(markdown: str, heading: str) -> Any:
    lines = re.sub(r"(?s)<!--.*?-->", "", markdown).splitlines()
    heading_line = f"## {heading}"
    heading_indices: list[int] = []
    fence: tuple[str, int] | None = None
    for index, line in enumerate(lines):
        stripped = line.lstrip()
        if fence is None:
            if line.rstrip() == heading_line:
                heading_indices.append(index)
            match = re.match(r"(?P<fence>`{3,}|~{3,})", stripped)
            if match is not None:
                opening = match.group("fence")
                fence = (opening[0], len(opening))
        else:
            fence_character, minimum_length = fence
            closing = re.match(rf"{re.escape(fence_character)}+", stripped)
            if (
                closing is not None
                and len(closing.group(0)) >= minimum_length
                and stripped[closing.end() :].strip() == ""
            ):
                fence = None
    if len(heading_indices) != 1:
        raise SourceError(f"Goal objective is missing {heading}")

    index = heading_indices[0] + 1
    while index < len(lines) and not lines[index].strip():
        index += 1
    if index >= len(lines):
        raise SourceError(f"Goal objective is missing {heading} JSON")
    opening_match = re.fullmatch(
        r"(?P<fence>`{3,}|~{3,})json[ \t]*", lines[index]
    )
    if opening_match is None:
        raise SourceError(f"Goal objective is missing {heading} JSON")
    opening = opening_match.group("fence")
    index += 1
    content_lines: list[str] = []
    while index < len(lines):
        stripped = lines[index]
        closing = re.match(rf"{re.escape(opening[0])}+", stripped)
        if (
            closing is not None
            and len(closing.group(0)) >= len(opening)
            and stripped[closing.end() :].strip() == ""
        ):
            break
        content_lines.append(lines[index])
        index += 1
    else:
        raise SourceError(f"Goal objective is missing {heading} JSON closing fence")
    try:
        return json.loads("\n".join(content_lines))
    except json.JSONDecodeError as error:
        raise SourceError(f"Goal objective {heading} JSON is invalid: {error}") from error


def visible_goal_markdown(markdown: str) -> str:
    without_comments = re.sub(r"(?s)<!--.*?-->", "", markdown)
    visible_lines: list[str] = []
    fence: tuple[str, int] | None = None
    for line in without_comments.splitlines(keepends=True):
        stripped = line.lstrip()
        if fence is None:
            if line.startswith(("\t", "    ")) or stripped.startswith(">"):
                visible_lines.append("\n" if line.endswith("\n") else "")
                continue
            match = re.match(r"(?P<fence>`{3,}|~{3,})", stripped)
            if match is None:
                visible_lines.append(line)
                continue
            opening = match.group("fence")
            fence = (opening[0], len(opening))
        else:
            fence_character, minimum_length = fence
            closing = re.match(rf"{re.escape(fence_character)}+", stripped)
            if (
                closing is not None
                and len(closing.group(0)) >= minimum_length
                and stripped[closing.end() :].strip() == ""
            ):
                fence = None
        visible_lines.append("\n" if line.endswith("\n") else "")
    return "".join(visible_lines)


def normalize_goal_block(value: str) -> str:
    return "\n".join(line.strip() for line in value.strip().splitlines())


def goal_section(markdown: str, heading: str) -> str:
    matches = list(
        re.finditer(rf"(?m)^## {re.escape(heading)}[ \t]*$", markdown)
    )
    if len(matches) != 1:
        raise SourceError(f"Goal objective must contain exactly one ## {heading}")
    start = matches[0].end()
    next_heading = re.search(r"(?m)^## ", markdown[start:])
    end = start + next_heading.start() if next_heading is not None else len(markdown)
    return markdown[start:end]


def structured_goal_ids(source: dict[str, Any]) -> list[str]:
    validation = source["validation"]
    if source["kind"] == "requirements_goal":
        entries = validation.get("requirements")
        if not isinstance(entries, list):
            raise SourceError("Goal source must contain structured scope IDs")
        ids = [entry.get("id") if isinstance(entry, dict) else None for entry in entries]
    else:
        gate = validation.get("coverage_gate")
        ids = gate.get("requirement_ids") if isinstance(gate, dict) else None
    if not isinstance(ids, list) or not ids or not all(
        isinstance(requirement_id, str) and requirement_id for requirement_id in ids
    ):
        raise SourceError("Goal source must contain structured scope IDs")
    return ids


def add_validated_scope(markdown: str, ids: list[str]) -> str:
    statement = (
        f"{VALIDATED_SCOPE_PREFIX} {', '.join(ids)}。"
        "全IDを扱い、今回の差分だけへ狭めない。"
    )
    existing = [
        line.strip()
        for line in visible_goal_markdown(markdown).splitlines()
        if line.strip().startswith(VALIDATED_SCOPE_PREFIX)
    ]
    if existing:
        if existing != [statement]:
            raise SourceError("Goal objective has an invalid Validated Scope statement")
        return markdown
    return re.sub(
        r"(?m)^## Goal[ \t]*$",
        lambda match: f"{match.group(0)}\n\n{statement}",
        markdown,
        count=1,
    )


def render_goal_objective(source: dict[str, Any]) -> str:
    kind = source["kind"]
    if kind not in GOAL_KINDS:
        raise SourceError("Goal objective rendering requires a Goal source")
    markdown = source["display"]["markdown"]
    visible_markdown = visible_goal_markdown(markdown)
    normalized_visible_markdown = normalize_goal_block(visible_markdown)
    for marker, pattern in GOAL_REQUIRED_MARKERS:
        if re.search(pattern, visible_markdown, re.MULTILINE) is None:
            raise SourceError(f"Goal objective is missing required marker: {marker}")
    goal_instructions = goal_section(visible_markdown, "Goal")
    context_packet = goal_section(visible_markdown, "Context Packet")
    goal_section(visible_markdown, "Done / Verification")
    for marker in ("Constraints", "Stop"):
        if re.search(rf"(?m)^- {marker}:[ \t]*\S.+$", context_packet) is None:
            raise SourceError(f"Goal objective Context Packet is missing {marker}")

    validation = source["validation"]
    if validation.get("mode") != "managed":
        raise SourceError("Goal objective rendering requires validation.mode=managed")
    if NARROW_GOAL_SCOPE_PATTERN.search(
        f"{goal_instructions}\n{context_packet}"
    ) is not None:
        raise SourceError("Goal objective must not narrow scope to the current delta")
    for heading, field in GOAL_GATE_FIELDS[kind]:
        if field not in validation:
            raise SourceError(f"Goal source is missing validation.{field}")
        if extract_goal_gate(markdown, heading) != validation[field]:
            raise SourceError(f"Goal objective {heading} does not match validation.{field}")

    for entries_field, content_fields in GOAL_SCOPE_FIELDS[kind]:
        entries = validation.get(entries_field)
        if not isinstance(entries, list):
            raise SourceError(f"validation.{entries_field} must be an array")
        for index, entry in enumerate(entries):
            if not isinstance(entry, dict):
                raise SourceError(f"validation.{entries_field}[{index}] must be an object")
            for content_field in content_fields:
                content = entry.get(content_field)
                normalized_content = content.strip() if isinstance(content, str) else ""
                if (
                    not normalized_content
                    or normalize_goal_block(normalized_content)
                    not in normalized_visible_markdown
                ):
                    raise SourceError(
                        "Goal objective is missing structured scope: "
                        f"validation.{entries_field}[{index}].{content_field}"
                    )
    return add_validated_scope(markdown, structured_goal_ids(source))


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def artifact_preamble(markdown: str) -> str:
    first_section = re.search(r"(?m)^## ", markdown)
    preamble = markdown if first_section is None else markdown[: first_section.start()]
    if not preamble.strip():
        raise SourceError("managed artifact display must contain a Markdown preamble")
    return preamble.strip()


def render_section(heading: Any, content: Any, label: str) -> str:
    if not isinstance(heading, str) or not heading.strip():
        raise SourceError(f"{label}.heading must be a non-empty string")
    if not isinstance(content, str) or not content.strip():
        raise SourceError(f"{label}.content must be a non-empty string")
    lines = content.strip().splitlines()
    expected_heading = f"## {heading.strip()}"
    if lines[0].strip() != expected_heading:
        raise SourceError(f"{label}.content must start with {expected_heading}")
    body = "\n".join(lines[1:]).strip()
    return expected_heading if not body else f"{expected_heading}\n\n{body}"


def requirement_definitions(content: str) -> list[tuple[str, str]]:
    definitions: list[tuple[str, str]] = []
    requirement_id: str | None = None
    lines: list[str] = []
    for line in content.strip().splitlines():
        match = REQUIREMENT_DEFINITION_LINE_PATTERN.match(line)
        if match is not None:
            if requirement_id is not None:
                definitions.append(
                    (requirement_id, "\n".join(lines).strip())
                )
            requirement_id = match.group("id")
            lines = [line]
        elif requirement_id is not None:
            lines.append(line)
    if requirement_id is not None:
        definitions.append((requirement_id, "\n".join(lines).strip()))
    return definitions


def render_requirements_sections(validation: dict[str, Any]) -> list[str]:
    entries = validation.get("sections")
    if not isinstance(entries, list) or not entries:
        raise SourceError("managed Requirements must contain validation.sections")
    sections_by_id: dict[str, str] = {}
    rendered: list[str] = []
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != {"id", "heading", "content"}:
            raise SourceError(
                "each Requirements section must contain only id, heading, and content"
            )
        section_id = entry["id"]
        if not isinstance(section_id, str) or not section_id:
            raise SourceError(f"validation.sections[{index}].id must be a string")
        if section_id in sections_by_id:
            raise SourceError(f"duplicate Requirements section: {section_id}")
        heading = entry["heading"]
        rendered_section = render_section(
            heading,
            entry["content"],
            f"validation.sections[{index}]",
        )
        if requirement_section_ids_for_heading(heading) != (section_id,):
            raise SourceError(
                f"Requirements section {section_id} heading does not match its canonical aliases"
            )
        sections_by_id[section_id] = entry["content"]
        rendered.append(rendered_section)

    requirements = validation.get("requirements")
    if not isinstance(requirements, list) or not requirements:
        raise SourceError("managed Requirements must contain validation.requirements")
    requirements_by_section: dict[str, list[tuple[str, str]]] = {
        section_id: [] for section_id in REQUIREMENT_SECTION_BY_PREFIX.values()
    }
    for index, entry in enumerate(requirements):
        if not isinstance(entry, dict) or set(entry) != {"id", "content"}:
            raise SourceError(
                "each requirement must contain only id and content"
            )
        requirement_id = entry["id"]
        content = entry["content"]
        if not isinstance(requirement_id, str) or not isinstance(content, str):
            raise SourceError(f"validation.requirements[{index}] is invalid")
        prefix = requirement_id.split("-", 1)[0]
        section_id = REQUIREMENT_SECTION_BY_PREFIX.get(prefix)
        if section_id is None:
            raise SourceError(f"unsupported requirement ID: {requirement_id}")
        normalized_content = content.strip()
        if requirement_definitions(normalized_content) != [
            (requirement_id, normalized_content)
        ]:
            raise SourceError(
                f"validation.requirements[{index}].content must define only {requirement_id}"
            )
        requirements_by_section[section_id].append(
            (requirement_id, normalized_content)
        )

    for section_id, section_requirements in requirements_by_section.items():
        section_content = sections_by_id.get(section_id)
        if section_content is None:
            raise SourceError(f"managed Requirements is missing section: {section_id}")
        expected_ids = sorted(
            (requirement_id for requirement_id, _ in section_requirements),
            key=requirement_sort_key,
        )
        if extract_requirement_mentions(section_content) != expected_ids:
            raise SourceError(
                f"Requirements section {section_id} does not match validation.requirements"
            )
        actual_definitions = requirement_definitions(section_content)
        if [requirement_id for requirement_id, _ in actual_definitions] != expected_ids:
            raise SourceError(
                f"Requirements section {section_id} definitions do not match validation.requirements"
            )
        for (requirement_id, content), (_, actual_content) in zip(
            section_requirements,
            actual_definitions,
        ):
            if actual_content != content:
                raise SourceError(
                    f"Requirements section {section_id} definition for {requirement_id} "
                    "does not match validation.requirements"
                )
    return rendered


def render_design_sections(validation: dict[str, Any]) -> list[str]:
    entries = validation.get("sections")
    if not isinstance(entries, list) or not entries:
        raise SourceError("managed Design must contain validation.sections")
    rendered: list[str] = []
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != {"heading", "content"}:
            raise SourceError(
                "each Design section must contain only heading and content"
            )
        rendered.append(
            render_section(
                entry["heading"],
                entry["content"],
                f"validation.sections[{index}]",
            )
        )
    return rendered


def render_gate(heading: str, value: Any) -> str:
    if not isinstance(value, dict):
        raise SourceError(f"validation gate must be an object: {heading}")
    return f"## {heading}\n\n```json\n{compact_json(value)}\n```"


def render_rule_selection(input_gate: Any) -> str:
    if not isinstance(input_gate, dict):
        raise SourceError("validation.input_gate must be an object")
    direct_rules = input_gate.get("direct_rules")
    dependencies = input_gate.get("depends_on")
    if not isinstance(direct_rules, list) or not isinstance(dependencies, list):
        raise SourceError("Requirements Input Gate rule selection is invalid")
    lines = ["## Rule Selection", ""]
    for index, entry in enumerate(direct_rules):
        if not isinstance(entry, dict):
            raise SourceError(f"direct_rules[{index}] must be an object")
        rule_id = entry.get("id")
        reason = entry.get("reason")
        if not isinstance(rule_id, str) or not isinstance(reason, str):
            raise SourceError(f"direct_rules[{index}] is invalid")
        lines.append(f"- Direct: `{rule_id}`。{reason.rstrip('。')}。")
    for index, entry in enumerate(dependencies):
        if not isinstance(entry, dict):
            raise SourceError(f"depends_on[{index}] must be an object")
        rule_id = entry.get("id")
        via = entry.get("via")
        if not isinstance(rule_id, str) or not isinstance(via, str):
            raise SourceError(f"depends_on[{index}] is invalid")
        lines.append(f"- Depends-on: `{rule_id}`（via `{via}`）。")
    lines.append("- Conflict: none。")
    return "\n".join(lines)


def render_artifact_markdown(source: dict[str, Any]) -> str:
    kind = source["kind"]
    if kind not in ARTIFACT_KINDS:
        raise SourceError("artifact Markdown rendering requires an artifact source")
    validation = source["validation"]
    mode = validation.get("mode")
    if mode == "legacy_import":
        return source["display"]["markdown"]
    if mode != "managed":
        raise SourceError("validation.mode must be managed or legacy_import")

    blocks = [artifact_preamble(source["display"]["markdown"])]
    if kind == "requirements":
        input_gate = validation.get("input_gate")
        blocks.extend(
            [
                render_gate("Requirements Input Gate", input_gate),
                render_gate(
                    "Requirements Completeness Gate",
                    validation.get("completeness_gate"),
                ),
                *render_requirements_sections(validation),
                render_rule_selection(input_gate),
            ]
        )
    else:
        blocks.extend(
            [
                *render_design_sections(validation),
                render_gate("Design Coverage Gate", validation.get("coverage_gate")),
            ]
        )
    return "\n\n".join(block.rstrip() for block in blocks) + "\n"


def check_or_write(
    source_path: Path,
    output_path: Path,
    check: bool,
    repo_root: Path | None = None,
) -> None:
    source = load_source(source_path)
    if source["kind"] in ARTIFACT_KINDS:
        if repo_root is None:
            raise SourceError("artifact rendering requires --repo-root")
        repo_root = require_git_worktree_root(repo_root)
        require_canonical_artifact_paths(
            repo_root,
            source_path,
            output_path,
            source,
        )
    markdown = (
        render_goal_objective(source)
        if source["kind"] in GOAL_KINDS
        else render_artifact_markdown(source)
    )
    check_or_write_markdown(markdown, output_path, check)


def check_or_write_markdown(markdown: str, output_path: Path, check: bool) -> None:
    if check:
        if not output_path.is_file():
            raise SourceError(f"generated Markdown is missing: {output_path}")
        try:
            current_markdown = output_path.read_bytes().decode("utf-8")
        except UnicodeDecodeError as error:
            raise SourceError(
                f"generated Markdown must be UTF-8: {output_path}"
            ) from error
        if normalize_markdown_newlines(
            current_markdown
        ) != normalize_markdown_newlines(markdown):
            raise SourceError(f"generated Markdown is stale: {output_path}")
        return
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(markdown.encode("utf-8"))


def check_all(repo_root: Path) -> int:
    repo_root = require_git_worktree_root(repo_root)
    workspace_root = (
        repo_root / "docs" / "ai-driven-development" / "workspaces"
    )
    pair_filenames = {
        SOURCE_FILENAMES[kind]: kind for kind in ARTIFACT_KINDS
    } | {
        DISPLAY_FILENAMES[kind]: kind for kind in ARTIFACT_KINDS
    }
    expected_pairs: set[tuple[str, str]] = set()
    listing = run_git(
        repo_root,
        [
            "ls-tree",
            "-r",
            "--name-only",
            "HEAD",
            "--",
            "docs/ai-driven-development/workspaces",
        ],
    )
    if listing.returncode != 0:
        raise SourceError("failed to inspect AIDD artifacts in Git HEAD")
    prefix = "docs/ai-driven-development/workspaces/"
    for tracked_path in listing.stdout.decode("utf-8").splitlines():
        if not tracked_path.startswith(prefix):
            continue
        workspace_and_filename = tracked_path.removeprefix(prefix).split("/", 1)
        if len(workspace_and_filename) != 2:
            continue
        workspace, filename = workspace_and_filename
        kind = pair_filenames.get(filename)
        if kind is not None:
            expected_pairs.add((workspace, kind))

    if workspace_root.is_dir():
        for workspace_path in workspace_root.iterdir():
            if not workspace_path.is_dir():
                continue
            for kind in ARTIFACT_KINDS:
                source_path = canonical_source_path(
                    repo_root, workspace_path.name, kind
                )
                output_path = canonical_display_path(
                    repo_root, workspace_path.name, kind
                )
                if source_path.exists() or output_path.exists():
                    expected_pairs.add((workspace_path.name, kind))

    checked = 0
    for source_path in sorted(workspace_root.glob("*/*.json")):
        source = load_source(source_path)
        kind = source["kind"]
        if kind not in ARTIFACT_KINDS:
            continue
        expected_source = canonical_source_path(
            repo_root,
            source["workspace"],
            kind,
        )
        if source_path != expected_source:
            raise SourceError(
                f"{kind} source must be {SOURCE_FILENAMES[kind]} in its workspace"
            )
        output_path = canonical_display_path(
            repo_root,
            source["workspace"],
            kind,
        )
        if source_path.is_symlink():
            raise SourceError(f"artifact source must not use a symlink: {source_path}")
        require_canonical_artifact_paths(repo_root, source_path, output_path, source)
        check_or_write_markdown(render_artifact_markdown(source), output_path, True)
        checked += 1
    for workspace, kind in sorted(expected_pairs):
        source_path = canonical_source_path(repo_root, workspace, kind)
        output_path = canonical_display_path(repo_root, workspace, kind)
        if not source_path.is_file():
            raise SourceError(f"artifact source is missing: {source_path}")
        if not output_path.is_file():
            raise SourceError(f"generated Markdown is missing: {output_path}")
    print(f"AIDD render check passed: {checked} artifacts")
    return checked


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--stdout", action="store_true")
    parser.add_argument("--repo-root", type=Path)
    parser.add_argument("--check-all", action="store_true")
    args = parser.parse_args()

    try:
        if args.check_all:
            if args.repo_root is None:
                raise SourceError("--check-all requires --repo-root")
            check_all(args.repo_root)
            return 0
        if args.source is None:
            raise SourceError("--source is required")
        source = load_source(args.source)
        if args.stdout:
            if source["kind"] in ARTIFACT_KINDS:
                raise SourceError(
                    "artifact rendering requires canonical --output and --repo-root"
                )
            sys.stdout.write(render_goal_objective(source))
            return 0
        if args.output is None:
            raise SourceError("--output is required without --stdout")
        check_or_write(args.source, args.output, args.check, args.repo_root)
    except (OSError, SourceError) as error:
        print(f"AIDD render failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
