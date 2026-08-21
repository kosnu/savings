#!/usr/bin/env python3
"""Validate that an AIDD Issue has one stable canonical workspace."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from git_baseline import (
    GitBaselineError,
    canonical_workspace_name,
    issue_number,
    list_issue_workspaces,
    validate_workspace_identity,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--issue", required=True)
    parser.add_argument("--issue-title")
    parser.add_argument("--workspace")
    args = parser.parse_args()

    try:
        workspace = args.workspace
        if workspace is None:
            existing = list_issue_workspaces(
                args.repo_root, issue_number(args.issue)
            )
            if len(existing) > 1:
                raise GitBaselineError(
                    "multiple workspaces already exist for the Issue; consolidate "
                    f"them before continuing: {', '.join(existing)}"
                )
            if existing:
                workspace = existing[0]
            else:
                if args.issue_title is None:
                    raise GitBaselineError(
                        "issue title is required to derive the first canonical workspace"
                    )
                workspace = canonical_workspace_name(args.issue, args.issue_title)
        existing = validate_workspace_identity(
            args.repo_root,
            args.issue,
            workspace,
            args.issue_title,
        )
    except GitBaselineError as error:
        print(f"workspace validation failed: {error}", file=sys.stderr)
        return 1

    status = "reused" if existing else "new"
    print(f"workspace validation passed: {workspace} ({status})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
