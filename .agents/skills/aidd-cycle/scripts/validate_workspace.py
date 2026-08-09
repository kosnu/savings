#!/usr/bin/env python3
"""Validate that an AIDD Issue has one stable, unversioned workspace."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from git_baseline import GitBaselineError, validate_workspace_identity


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--issue", required=True)
    parser.add_argument("--workspace", required=True)
    args = parser.parse_args()

    try:
        existing = validate_workspace_identity(
            args.repo_root,
            args.issue,
            args.workspace,
        )
    except GitBaselineError as error:
        print(f"workspace validation failed: {error}", file=sys.stderr)
        return 1

    status = "reused" if existing else "new"
    print(f"workspace validation passed: {args.workspace} ({status})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
