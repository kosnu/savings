#!/usr/bin/env python3
"""Render or check human-readable Markdown from structured AIDD sources."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from artifact_source import (
    ARTIFACT_KINDS,
    SOURCE_FILENAMES,
    SourceError,
    canonical_display_path,
    canonical_source_path,
    load_source,
)


def check_or_write(source_path: Path, output_path: Path, check: bool) -> None:
    source = load_source(source_path)
    markdown = source["display"]["markdown"]
    if check:
        if not output_path.is_file():
            raise SourceError(f"generated Markdown is missing: {output_path}")
        if output_path.read_text(encoding="utf-8") != markdown:
            raise SourceError(f"generated Markdown is stale: {output_path}")
        return
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")


def check_all(repo_root: Path) -> int:
    workspace_root = (
        repo_root / "docs" / "ai-driven-development" / "workspaces"
    )
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
        check_or_write(source_path, output_path, True)
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
            check_all(args.repo_root.resolve())
            return 0
        if args.source is None:
            raise SourceError("--source is required")
        source = load_source(args.source)
        if args.stdout:
            sys.stdout.write(source["display"]["markdown"])
            return 0
        if args.output is None:
            raise SourceError("--output is required without --stdout")
        check_or_write(args.source, args.output, args.check)
    except (OSError, SourceError) as error:
        print(f"AIDD render failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
