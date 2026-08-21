#!/usr/bin/env python3
"""Capture the canonical Design completion receipt."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from artifact_source import SourceError
from git_baseline import GitBaselineError
from validate_build_entry import ValidationError, validate_or_capture
from validate_design_coverage import ValidationError as DesignValidationError


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--issue", required=True)
    parser.add_argument("--issue-url", required=True)
    parser.add_argument("--issue-updated-at", required=True)
    parser.add_argument("--issue-body", required=True, type=Path)
    parser.add_argument("--rule-map", required=True, type=Path)
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--goal-document", required=True, type=Path)
    args = parser.parse_args()

    try:
        receipt_path, receipt_sha256 = validate_or_capture(
            args.issue,
            args.issue_url,
            args.issue_updated_at,
            args.issue_body,
            args.rule_map,
            args.repo_root,
            args.workspace,
            capture=True,
            goal_document_path=args.goal_document,
        )
    except (
        OSError,
        UnicodeDecodeError,
        GitBaselineError,
        SourceError,
        DesignValidationError,
        ValidationError,
    ) as error:
        print(f"design completion gate: failed: {error}", file=sys.stderr)
        return 1

    print(
        "design completion gate: captured: "
        f"{receipt_path} sha256={receipt_sha256}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
