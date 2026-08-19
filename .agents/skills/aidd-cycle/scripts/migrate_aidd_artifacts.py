#!/usr/bin/env python3
"""Verify managed AIDD artifacts."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from artifact_source import (
    SOURCE_FILENAMES,
    SourceError,
    canonical_display_path,
    canonical_source_path,
    load_regular_source,
    normalize_markdown_newlines,
    read_regular_file_bytes,
)
from git_baseline import GitBaselineError, list_git_head_managed_artifact_keys
from render_aidd_artifact import (
    render_artifact_markdown,
    require_git_worktree_root,
    require_no_symlinks,
)


def expected_pairs(repo_root: Path) -> list[tuple[Path, Path, str]]:
    root = repo_root / "docs" / "ai-driven-development" / "workspaces"
    require_no_symlinks(repo_root, root, "AIDD workspace root")
    source_names = {
        filename: kind for kind, filename in SOURCE_FILENAMES.items()
    }
    keys = list_git_head_managed_artifact_keys(repo_root)

    if root.is_dir():
        for workspace_dir in sorted(root.iterdir()):
            require_no_symlinks(repo_root, workspace_dir, "AIDD workspace")
            if not workspace_dir.is_dir():
                continue
            for filename, kind in source_names.items():
                path = workspace_dir / filename
                if path.exists() or path.is_symlink():
                    keys.add((workspace_dir.name, kind))

    return [
        (
            canonical_display_path(repo_root, workspace, kind),
            canonical_source_path(repo_root, workspace, kind),
            kind,
        )
        for workspace, kind in sorted(keys)
    ]


def migrate(repo_root: Path) -> int:
    repo_root = require_git_worktree_root(repo_root)
    checked = 0
    for display_path, source_path, kind in expected_pairs(repo_root):
        require_no_symlinks(repo_root, display_path, "artifact display")
        require_no_symlinks(repo_root, source_path, "artifact source")
        if not source_path.is_file():
            raise SourceError(f"artifact source is missing: {source_path}")
        if not display_path.is_file():
            raise SourceError(f"artifact display is missing: {display_path}")
        markdown = normalize_markdown_newlines(
            read_regular_file_bytes(display_path).decode("utf-8")
        )
        source = load_regular_source(source_path, kind)
        if source["workspace"] != display_path.parent.name:
            raise SourceError(f"workspace mismatch: {source_path}")
        if (
            normalize_markdown_newlines(render_artifact_markdown(source)) != markdown
        ):
            raise SourceError(f"Markdown round-trip mismatch: {display_path}")
        checked += 1
    print(f"AIDD migration check passed: {checked} managed artifacts")
    return checked


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--check", action="store_true", required=True)
    args = parser.parse_args()
    try:
        migrate(args.repo_root)
    except (OSError, UnicodeDecodeError, GitBaselineError, SourceError) as error:
        print(f"AIDD migration failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
