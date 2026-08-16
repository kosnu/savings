#!/usr/bin/env python3
"""Import existing AIDD Markdown once and verify structured sidecars."""

from __future__ import annotations

import argparse
import copy
import errno
import hashlib
import json
import os
import re
import stat
import sys
from pathlib import Path
from typing import Any

from artifact_source import (
    SourceError,
    canonical_source_path,
    decode_source_json,
    load_baseline_source_bytes,
    normalize_markdown_newlines,
    open_directory_without_symlinks,
    read_regular_file_bytes,
    serialize_source,
    validate_legacy_artifact_source,
    validate_managed_artifact_source,
    validate_managed_goal_source,
    validate_source,
    write_regular_file_atomically,
)
from git_baseline import load_regular_head_blob, run_git
from requirement_ids import (
    legacy_design_inventory,
    legacy_requirements_inventory,
    mask_non_rendered_markdown,
)
from render_aidd_artifact import (
    render_artifact_markdown,
    require_git_worktree_root,
    require_no_symlinks,
)


GATE_HEADINGS = {
    "input_gate": "Requirements Input Gate",
    "completeness_gate": "Requirements Completeness Gate",
    "coverage_gate": "Design Coverage Gate",
}
GOAL_SCOPE_PATTERN = re.compile(
    r"(?m)^ {0,3}-\s+((?:FR|NFR|AC)-[1-9][0-9]*) "
    r"(design|verification) scope:\s*(.+)$"
)
BASELINE_SCOPE_PATTERN = re.compile(
    r"(?m)^ {0,3}-\s+(.+?) baseline scope:\s*(.+)$"
)
GOAL_CONTEXT_CONTRACT_PATTERN = re.compile(
    r"- (Constraints|Stop) \[([a-z0-9][a-z0-9-]*)\]:\s*(.+)"
)
GOAL_DONE_CONTRACT_PATTERN = re.compile(
    r"- \[([a-z0-9][a-z0-9-]*)\]\s+(.+)"
)


def legacy_level_two_headings(markdown: str) -> list[tuple[int, str]]:
    return [
        (match.start(), match.group("heading").strip())
        for match in re.finditer(
            r"(?m)^ {0,3}##(?:[ \t]+|$)(?P<heading>.*?)(?:[ \t]+#+[ \t]*)?$",
            markdown,
        )
    ]


def parse_gate(markdown: str, name: str) -> dict[str, Any] | None:
    heading = GATE_HEADINGS[name]
    visible = mask_non_rendered_markdown(markdown)
    matches = [
        candidate
        for _, candidate in legacy_level_two_headings(visible)
        if candidate == heading
    ]
    if not matches:
        return None
    if len(matches) != 1:
        raise SourceError(f"{name} must appear exactly once")
    source_lines = markdown.splitlines()
    visible_lines = visible.splitlines()
    heading_index = next(
        index
        for index, line in enumerate(visible_lines)
        if line.rstrip() == f"## {heading}"
    )
    index = heading_index + 1
    while index < len(source_lines) and not source_lines[index].strip():
        index += 1
    if index >= len(source_lines) or source_lines[index].strip() != "```json":
        raise SourceError(f"{name} JSON fence is missing")
    index += 1
    content: list[str] = []
    while index < len(source_lines) and source_lines[index].strip() != "```":
        content.append(source_lines[index])
        index += 1
    if index >= len(source_lines):
        raise SourceError(f"{name} JSON fence is not closed")
    value = decode_source_json("\n".join(content))
    if not isinstance(value, dict):
        raise SourceError(f"{name} must contain a JSON object")
    return value


def requirements_inventory(markdown: str) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    return legacy_requirements_inventory(markdown)


def design_inventory(markdown: str) -> list[dict[str, str]]:
    return legacy_design_inventory(markdown)


def build_source(workspace: str, kind: str, markdown: str) -> dict[str, Any]:
    """Import an unmanaged Markdown artifact into an immutable legacy envelope."""

    markdown = normalize_markdown_newlines(markdown)
    digest = hashlib.sha256(markdown.encode("utf-8")).hexdigest()
    if kind == "requirements":
        requirements, sections = requirements_inventory(markdown)
        validation: dict[str, Any] = {
            "mode": "legacy_import",
            "source_markdown_sha256": digest,
            "requirements": requirements,
            "sections": sections,
        }
        inventory = {"requirements": requirements, "sections": sections}
    else:
        sections = design_inventory(markdown)
        validation = {
            "mode": "legacy_import",
            "source_markdown_sha256": digest,
            "sections": sections,
        }
        inventory = {"sections": sections}
    validation["inventory_sha256"] = hashlib.sha256(
        json.dumps(
            inventory, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
    ).hexdigest()
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


def legacy_goal_section(markdown: str, heading: str) -> str:
    """Read one canonical Goal section inside the explicit import boundary."""

    source_lines = markdown.splitlines()
    visible_lines = mask_non_rendered_markdown(markdown).splitlines()
    indexes = [
        index
        for index, line in enumerate(visible_lines)
        if line.rstrip() == f"## {heading}"
    ]
    if len(indexes) != 1:
        raise SourceError(f"Goal objective must contain exactly one ## {heading}")
    start = indexes[0] + 1
    end = next(
        (
            index
            for index in range(start, len(visible_lines))
            if visible_lines[index].startswith("## ")
        ),
        len(source_lines),
    )
    return "\n".join(source_lines[start:end]).strip()


def legacy_goal_display(markdown: str) -> dict[str, Any]:
    visible_lines = mask_non_rendered_markdown(markdown).splitlines()
    titles = [line[2:].strip() for line in visible_lines if line.startswith("# ")]
    if len(titles) != 1:
        raise SourceError("Goal objective must contain exactly one level-one title")
    context_lines = legacy_goal_section(markdown, "Context Packet").splitlines()
    constraints: list[dict[str, str]] = []
    stops: list[dict[str, str]] = []
    body_lines: list[str] = []
    for line in context_lines:
        stripped_line = line.strip()
        if stripped_line.startswith(("- Constraints", "- Stop")):
            match = GOAL_CONTEXT_CONTRACT_PATTERN.fullmatch(stripped_line)
            if match is None:
                raise SourceError(
                    "Goal Constraints and Stop entries must include stable IDs"
                )
            entry = {"id": match.group(2), "text": match.group(3).strip()}
            (constraints if match.group(1) == "Constraints" else stops).append(entry)
        else:
            body_lines.append(line)
    body = "\n".join(body_lines).strip()
    if not constraints or not stops:
        raise SourceError("Goal context must contain Constraints and Stop")
    done: list[dict[str, str]] = []
    for line in legacy_goal_section(markdown, "Done / Verification").splitlines():
        stripped_line = line.strip()
        if not stripped_line:
            continue
        match = GOAL_DONE_CONTRACT_PATTERN.fullmatch(stripped_line)
        if match is None:
            raise SourceError("Goal Done entries must include stable IDs")
        done.append({"id": match.group(1), "text": match.group(2).strip()})
    return {
        "path": "goal.md",
        "title": titles[0],
        "goal": " ".join(legacy_goal_section(markdown, "Goal").split()),
        "context": {
            "body": [line.strip() for line in body.splitlines() if line.strip()],
            "constraints": constraints,
            "stop": stops,
        },
        "done": done,
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
            "requirements": [
                {
                    "id": entry["id"],
                    "text": entry["content"].removeprefix(f"- {entry['id']}: "),
                }
                for entry in requirements
            ],
        }
        source_kind = "requirements_goal"
    else:
        coverage_gate = parse_gate(markdown, "coverage_gate")
        if coverage_gate is None:
            raise SourceError("Design Goal coverage gate is missing")
        visible_markdown = mask_non_rendered_markdown(markdown)
        scopes_by_id: dict[str, dict[str, str]] = {}
        for requirement_id, scope_kind, text in GOAL_SCOPE_PATTERN.findall(
            visible_markdown
        ):
            entry = scopes_by_id.setdefault(requirement_id, {"id": requirement_id})
            field = f"{scope_kind}_scope"
            if field in entry:
                raise SourceError(
                    f"duplicate Design Goal scope: {requirement_id} {scope_kind}"
                )
            entry[field] = text
        expected_ids = coverage_gate.get("requirement_ids")
        if not isinstance(expected_ids, list) or not all(
            isinstance(requirement_id, str) for requirement_id in expected_ids
        ):
            raise SourceError("Design Goal requirement_ids are missing")
        if set(scopes_by_id) != set(expected_ids):
            raise SourceError(
                "Design Goal scope IDs must exactly match requirement_ids"
            )
        scopes = [scopes_by_id.get(requirement_id) for requirement_id in expected_ids]
        if any(
            not isinstance(entry, dict)
            or set(entry) != {"id", "design_scope", "verification_scope"}
            for entry in scopes
        ):
            raise SourceError("Design Goal scopes are incomplete")
        baseline_scopes = [
            {
                "section_id": None,
                "heading": heading.strip(),
                "review_scope": text,
            }
            for heading, text in BASELINE_SCOPE_PATTERN.findall(visible_markdown)
        ]
        validation = {
            "mode": "managed",
            "coverage_gate": coverage_gate,
            "scopes": scopes,
            "baseline_scopes": baseline_scopes,
        }
        source_kind = "design_goal"
    return validate_managed_goal_source({
        "schema_version": 2,
        "kind": source_kind,
        "workspace": workspace,
        "display": legacy_goal_display(markdown),
        "validation": validation,
    })


def expected_pairs(repo_root: Path) -> list[tuple[Path, Path, str]]:
    root = repo_root / "docs" / "ai-driven-development" / "workspaces"
    require_no_symlinks(repo_root, root, "AIDD workspace root")
    artifact_names = {
        "requirements.md": "requirements",
        "requirements.json": "requirements",
        "design-doc.md": "design",
        "design-doc.json": "design",
    }
    keys: set[tuple[str, str]] = set()

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
    for value in listing.stdout.decode("utf-8").splitlines():
        relative = Path(value)
        if len(relative.parts) != 5:
            continue
        kind = artifact_names.get(relative.name)
        if kind is not None:
            keys.add((relative.parent.name, kind))

    if root.is_dir():
        for workspace_dir in sorted(root.iterdir()):
            require_no_symlinks(repo_root, workspace_dir, "AIDD workspace")
            if not workspace_dir.is_dir():
                continue
            for filename, kind in artifact_names.items():
                path = workspace_dir / filename
                if path.exists() or path.is_symlink():
                    keys.add((workspace_dir.name, kind))

    return [
        (
            repo_root
            / "docs"
            / "ai-driven-development"
            / "workspaces"
            / workspace
            / ("requirements.md" if kind == "requirements" else "design-doc.md"),
            canonical_source_path(repo_root, workspace, kind),
            kind,
        )
        for workspace, kind in sorted(keys)
    ]


def normalized_managed_source(
    source: dict[str, Any],
) -> dict[str, Any]:
    normalized = copy.deepcopy(source)
    normalized["validation"].pop("source_markdown_sha256", None)
    return validate_managed_artifact_source(normalized)


def normalized_legacy_source(source: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(source)
    validation = normalized["validation"]
    inventory = {"sections": validation["sections"]}
    if normalized["kind"] == "requirements":
        inventory["requirements"] = validation["requirements"]
    validation["inventory_sha256"] = hashlib.sha256(
        json.dumps(
            inventory, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
    ).hexdigest()
    return validate_legacy_artifact_source(normalized)


def regular_file_matches(path: Path, content: str) -> bool:
    """Compare a destination without following its final symlink component."""

    directory_fd = open_directory_without_symlinks(path.parent)
    expected = content.encode("utf-8")
    file_flags = os.O_RDONLY | getattr(os, "O_NONBLOCK", 0)
    if hasattr(os, "O_NOFOLLOW"):
        file_flags |= os.O_NOFOLLOW
    try:
        try:
            file_descriptor = os.open(path.name, file_flags, dir_fd=directory_fd)
        except FileNotFoundError:
            return False
        except OSError as error:
            if error.errno == errno.ELOOP:
                return False
            raise
        with os.fdopen(file_descriptor, "rb") as source:
            if not stat.S_ISREG(os.fstat(source.fileno()).st_mode):
                return False
            return source.read(len(expected) + 1) == expected
    finally:
        os.close(directory_fd)


def migrate(repo_root: Path, write: bool) -> int:
    repo_root = require_git_worktree_root(repo_root)
    prepared: list[tuple[Path, str]] = []
    checked = 0
    for display_path, source_path, kind in expected_pairs(repo_root):
        require_no_symlinks(repo_root, display_path, "artifact display")
        require_no_symlinks(repo_root, source_path, "artifact source")
        if not display_path.is_file():
            raise SourceError(f"artifact display is missing: {display_path}")
        markdown = normalize_markdown_newlines(
            read_regular_file_bytes(display_path).decode("utf-8")
        )
        existing = None
        if source_path.is_file():
            decoded = decode_source_json(
                read_regular_file_bytes(source_path).decode("utf-8")
            )
            existing = validate_source(decoded, kind)
        head_source_bytes = load_regular_head_blob(
            repo_root,
            source_path.relative_to(repo_root).as_posix(),
            "AIDD migration source",
        )
        head_source = None
        if head_source_bytes is not None:
            head_value = decode_source_json(head_source_bytes.decode("utf-8"))
            head_validation = (
                head_value.get("validation")
                if isinstance(head_value, dict)
                else None
            )
            if isinstance(head_validation, dict):
                if head_validation.get("mode") == "managed":
                    head_source = load_baseline_source_bytes(head_source_bytes, kind)
                elif head_validation.get("mode") == "legacy_import":
                    head_source = normalized_legacy_source(head_value)
        if existing is None:
            if head_source_bytes is not None:
                raise SourceError(
                    f"Git HEAD source is missing from worktree: {source_path}"
                )
            if not write:
                raise SourceError(f"artifact source is missing: {source_path}")
            source = build_source(display_path.parent.name, kind, markdown)
        elif existing["validation"].get("mode") == "managed":
            normalized = normalized_managed_source(existing)
            if not write and existing != normalized:
                raise SourceError(f"managed source is not normalized: {source_path}")
            source = normalized if write else existing
        else:
            normalized = normalized_legacy_source(existing)
            if not write and existing != normalized:
                raise SourceError(f"legacy source is not normalized: {source_path}")
            source = normalized if write else existing
        if (
            head_source is not None
            and head_source["validation"].get("mode") == "managed"
            and source["validation"].get("mode") != "managed"
        ):
            raise SourceError(f"managed Git HEAD source cannot be downgraded: {source_path}")
        if (
            head_source is not None
            and head_source["validation"].get("mode") == "legacy_import"
            and source["validation"].get("mode") == "legacy_import"
            and source != head_source
        ):
            raise SourceError(
                f"legacy Git HEAD source is immutable: {source_path}"
            )
        if source["workspace"] != display_path.parent.name:
            raise SourceError(f"workspace mismatch: {source_path}")
        if source["validation"].get("mode") == "managed":
            validate_managed_artifact_source(source)
        else:
            validate_legacy_artifact_source(source)
            expected_legacy_source = build_source(
                display_path.parent.name,
                kind,
                markdown,
            )
            if source != expected_legacy_source:
                raise SourceError(
                    f"legacy import differs from source Markdown: {source_path}"
                )
        if (
            normalize_markdown_newlines(render_artifact_markdown(source)) != markdown
        ):
            raise SourceError(f"Markdown round-trip mismatch: {display_path}")
        if (
            source["validation"].get("mode") == "legacy_import"
            and source["validation"].get("source_markdown_sha256")
            != hashlib.sha256(markdown.encode("utf-8")).hexdigest()
        ):
            raise SourceError(f"Markdown digest mismatch: {source_path}")
        if write:
            prepared.append((source_path, serialize_source(source)))
        checked += 1
    for source_path, serialized in prepared:
        if not regular_file_matches(source_path, serialized):
            write_regular_file_atomically(source_path, serialized)
    print(f"AIDD migration {'wrote' if write else 'check passed'}: {checked} artifacts")
    return checked


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--import-legacy", action="store_true")
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
                read_regular_file_bytes(args.goal_markdown).decode("utf-8"),
            )
            output_path = Path(os.path.abspath(args.output))
            write_regular_file_atomically(output_path, serialize_source(source))
            print(f"AIDD Goal migration wrote: {args.output}")
            return 0
        migrate(args.repo_root, args.import_legacy)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError, SourceError) as error:
        print(f"AIDD migration failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
