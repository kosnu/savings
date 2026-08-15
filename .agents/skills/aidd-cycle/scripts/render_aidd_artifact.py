#!/usr/bin/env python3
"""Render or check human-readable Markdown from structured AIDD sources."""

from __future__ import annotations

import argparse
import json
import os
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
    load_regular_source,
    normalize_markdown_newlines,
    read_regular_file_bytes,
    require_inline_markdown,
    validate_loaded_source,
    write_regular_file_atomically,
)
from git_baseline import GitBaselineError, require_repository_root, run_git


def normalized_path(path: Path) -> Path:
    return Path(os.path.abspath(path))


def require_git_worktree_root(repo_root: Path) -> Path:
    absolute_root = normalized_path(repo_root)
    try:
        resolved_root = require_repository_root(absolute_root)
    except GitBaselineError as error:
        raise SourceError(str(error)) from error
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


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


MARKDOWN_ASCII_PUNCTUATION = frozenset(
    "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"
)


def render_plain_text(value: str) -> str:
    """Make a typed plain-text field visible without interpreting Markdown."""

    return "".join(
        f"\\{character}" if character in MARKDOWN_ASCII_PUNCTUATION else character
        for character in value
    )


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
        rule_id = require_inline_markdown(rule_id, f"direct_rules[{index}].id")
        reason = require_inline_markdown(reason, f"direct_rules[{index}].reason")
        lines.append(
            f"- Direct: `{rule_id}`。{render_plain_text(reason.rstrip('。'))}。"
        )
    for index, entry in enumerate(dependencies):
        if not isinstance(entry, dict):
            raise SourceError(f"depends_on[{index}] must be an object")
        rule_id = entry.get("id")
        via = entry.get("via")
        rule_id = require_inline_markdown(rule_id, f"depends_on[{index}].id")
        via = require_inline_markdown(via, f"depends_on[{index}].via")
        lines.append(f"- Depends-on: `{rule_id}`（via `{via}`）。")
    lines.append("- Conflict: none。")
    return "\n".join(lines)


def render_v2_blocks(
    blocks: list[dict[str, Any]],
    requirements: list[dict[str, Any]],
    section_id: str,
) -> str:
    """Render typed display blocks without parsing their Markdown output."""

    rendered: list[tuple[str, str]] = []
    for block in blocks:
        block_type = block["type"]
        if block_type == "markdown":
            rendered.append((block_type, block["markdown"].strip()))
        elif block_type == "evidence":
            owner_id = block["owner_id"].strip()
            role = block["role"]
            text = block["text"].strip()
            redundant_prefix = f"{owner_id} {role}: "
            if text.startswith(redundant_prefix):
                text = text.removeprefix(redundant_prefix)
            rendered.append(
                (
                    block_type,
                    f"{render_plain_text(owner_id)} {role}: {render_plain_text(text)}",
                )
            )
        elif block_type == "requirements":
            rendered.append(
                (
                    block_type,
                    "\n".join(
                        f"- {entry['id']}: {render_plain_text(entry['text'].strip())}"
                        for entry in requirements
                        if entry["section_id"] == section_id
                    ),
                )
            )
        else:
            raise SourceError(f"unsupported block type: {block_type}")
    output = ""
    previous_type: str | None = None
    for block_type, part in rendered:
        if not part:
            continue
        separator = "\n" if previous_type == block_type == "evidence" else "\n\n"
        output += (separator if output else "") + part
        previous_type = block_type
    return output


def render_v2_sections(
    sections: list[dict[str, Any]],
    requirements: list[dict[str, Any]] | None = None,
) -> list[str]:
    requirement_entries = requirements or []
    rendered: list[str] = []
    for section in sections:
        body = render_v2_blocks(
            section["blocks"], requirement_entries, section["id"]
        )
        heading = f"## {render_plain_text(section['heading'])}"
        rendered.append(heading if not body else f"{heading}\n\n{body}")
    return rendered


def render_goal_objective(source: dict[str, Any]) -> str:
    """Render a Goal from typed JSON fields only."""

    source = validate_loaded_source(source)
    kind = source["kind"]
    if kind not in GOAL_KINDS:
        raise SourceError("Goal objective rendering requires a Goal source")
    display = source["display"]
    validation = source["validation"]
    context = display["context"]
    scope_ids = (
        [entry["id"] for entry in validation["requirements"]]
        if kind == "requirements_goal"
        else validation["coverage_gate"]["requirement_ids"]
    )
    blocks = [
        f"# {render_plain_text(display['title'])}",
        f"## Goal\n\n{render_plain_text(display['goal'].strip())}",
        "## Context Packet\n\n"
        + "\n\n".join(render_plain_text(item) for item in context["body"])
        + "\n\n"
        + "\n".join(
            [
                *(
                    f"- Constraints: {render_plain_text(item)}"
                    for item in context["constraints"]
                ),
                *(
                    f"- Stop: {render_plain_text(item)}"
                    for item in context["stop"]
                ),
                f"- Validated Scope: {', '.join(scope_ids)}",
            ]
        ),
    ]
    if kind == "requirements_goal":
        blocks.extend(
            [
                render_gate("Requirements Input Gate", validation["input_gate"]),
                render_gate(
                    "Requirements Completeness Gate",
                    validation["completeness_gate"],
                ),
                "## Requirement Scope\n\n"
                + "\n".join(
                    f"- {entry['id']}: {render_plain_text(entry['text'].strip())}"
                    for entry in validation["requirements"]
                ),
            ]
        )
    else:
        blocks.append(render_gate("Design Coverage Gate", validation["coverage_gate"]))
        scope_lines: list[str] = []
        for entry in validation["scopes"]:
            requirement_id = entry["id"]
            design_scope = entry["design_scope"]
            verification_scope = entry["verification_scope"]
            design_scope = design_scope.removeprefix(
                f"{requirement_id} design scope: "
            )
            verification_scope = verification_scope.removeprefix(
                f"{requirement_id} verification scope: "
            )
            scope_lines.extend(
                [
                    f"- {render_plain_text(requirement_id)} design scope: {render_plain_text(design_scope)}",
                    f"- {render_plain_text(requirement_id)} verification scope: {render_plain_text(verification_scope)}",
                ]
            )
        for entry in validation["baseline_scopes"]:
            section_id = entry["section_id"]
            heading = entry["heading"]
            identity = heading if section_id is None else f"{section_id} ({heading})"
            review_scope = entry["review_scope"]
            for prefix in (
                f"{identity} baseline scope: ",
                f"{heading} baseline scope: ",
            ):
                if review_scope.startswith(prefix):
                    review_scope = review_scope.removeprefix(prefix)
                    break
            scope_lines.append(
                f"- {render_plain_text(identity)} baseline scope: {render_plain_text(review_scope)}"
            )
        blocks.append("## Requirement Design Scope\n\n" + "\n".join(scope_lines))
    blocks.append(
        "## Done / Verification\n\n"
        + "\n".join(render_plain_text(item) for item in display["done"])
    )
    return "\n\n".join(block.rstrip() for block in blocks) + "\n"


def render_artifact_markdown(source: dict[str, Any]) -> str:
    """Render an artifact from JSON fields without interpreting Markdown."""

    source = validate_loaded_source(source)
    kind = source["kind"]
    if kind not in ARTIFACT_KINDS:
        raise SourceError("artifact Markdown rendering requires an artifact source")
    validation = source["validation"]
    if validation["mode"] == "legacy_import":
        return source["display"]["markdown"]
    blocks = [source["display"]["preamble"].strip()]
    if kind == "requirements":
        blocks.extend(
            [
                render_gate("Requirements Input Gate", validation["input_gate"]),
                render_gate(
                    "Requirements Completeness Gate",
                    validation["completeness_gate"],
                ),
                *render_v2_sections(
                    validation["sections"], validation["requirements"]
                ),
                render_rule_selection(validation["input_gate"]),
            ]
        )
    else:
        blocks.extend(
            [
                *render_v2_sections(validation["sections"]),
                render_gate("Design Coverage Gate", validation["coverage_gate"]),
            ]
        )
    return "\n\n".join(block.rstrip() for block in blocks) + "\n"


def check_or_write(
    source_path: Path,
    output_path: Path,
    check: bool,
    repo_root: Path | None = None,
) -> None:
    if repo_root is not None:
        repo_root = require_git_worktree_root(repo_root)
    source = load_regular_source(source_path)
    if source["kind"] in ARTIFACT_KINDS:
        if repo_root is None:
            raise SourceError("artifact rendering requires --repo-root")
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
            current_markdown = read_regular_file_bytes(output_path).decode("utf-8")
        except UnicodeDecodeError as error:
            raise SourceError(
                f"generated Markdown must be UTF-8: {output_path}"
            ) from error
        if normalize_markdown_newlines(
            current_markdown
        ) != normalize_markdown_newlines(markdown):
            raise SourceError(f"generated Markdown is stale: {output_path}")
        return
    write_regular_file_atomically(
        Path(os.path.abspath(output_path)),
        markdown,
    )


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
    source_filename_kinds = {
        SOURCE_FILENAMES[kind]: kind for kind in ARTIFACT_KINDS
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
        source = load_regular_source(source_path)
        kind = source["kind"]
        canonical_kind = source_filename_kinds.get(source_path.name)
        if canonical_kind is not None and kind != canonical_kind:
            raise SourceError(
                f"{source_path.name} must contain {canonical_kind} artifact source"
            )
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
        source = load_regular_source(args.source)
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
