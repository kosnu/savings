#!/usr/bin/env python3
"""Render or check human-readable Markdown from structured AIDD sources."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from artifact_source import (
    ARTIFACT_KINDS,
    DISPLAY_FILENAMES,
    SOURCE_FILENAMES,
    SourceError,
    canonical_display_path,
    canonical_source_path,
    load_source,
    normalize_markdown_newlines,
)
from git_baseline import GitBaselineError, require_repository_root


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
    check_or_write_markdown(source["display"]["markdown"], output_path, check)


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
    display_kinds = {
        DISPLAY_FILENAMES[kind]: kind
        for kind in ARTIFACT_KINDS
    }
    for output_path in sorted(workspace_root.glob("*/*.md")):
        kind = display_kinds.get(output_path.name)
        if kind is None:
            continue
        source_path = canonical_source_path(
            repo_root,
            output_path.parent.name,
            kind,
        )
        if not source_path.is_file():
            raise SourceError(f"artifact source is missing: {source_path}")
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
        check_or_write_markdown(source["display"]["markdown"], output_path, True)
        checked += 1
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
            sys.stdout.write(source["display"]["markdown"])
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
