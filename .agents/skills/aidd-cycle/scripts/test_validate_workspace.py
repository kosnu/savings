from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from git_baseline import GitBaselineError, validate_workspace_identity


VALIDATOR_PATH = Path(__file__).with_name("validate_workspace.py")


def run_git(repo_root: Path, *arguments: str) -> None:
    subprocess.run(
        ["git", "-C", str(repo_root), *arguments],
        check=True,
        capture_output=True,
    )


def initialize_repo(repo_root: Path, workspaces: tuple[str, ...] = ()) -> None:
    run_git(repo_root, "init", "-q")
    run_git(repo_root, "config", "user.name", "AIDD Test")
    run_git(repo_root, "config", "user.email", "aidd@example.com")
    for workspace in workspaces:
        artifact = (
            repo_root
            / "docs"
            / "ai-driven-development"
            / "workspaces"
            / workspace
            / "requirements.md"
        )
        artifact.parent.mkdir(parents=True, exist_ok=True)
        artifact.write_text("# Requirements\n", encoding="utf-8")
    run_git(repo_root, "add", ".")
    run_git(repo_root, "commit", "--allow-empty", "-qm", "baseline")


class WorkspaceValidationTest(unittest.TestCase):
    def test_accepts_first_unversioned_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            initialize_repo(repo_root)
            existing = validate_workspace_identity(
                repo_root,
                "owner/repo#1563",
                "1563-sync-language-setting",
            )
        self.assertEqual(existing, [])

    def test_reuses_the_only_existing_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            initialize_repo(repo_root, ("1563-sync-language-setting",))
            existing = validate_workspace_identity(
                repo_root,
                "owner/repo#1563",
                "1563-sync-language-setting",
            )
        self.assertEqual(existing, ["1563-sync-language-setting"])

    def test_rejects_a_second_workspace_for_the_same_issue(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            initialize_repo(repo_root, ("1563-sync-language-setting",))
            with self.assertRaisesRegex(GitBaselineError, "reuse"):
                validate_workspace_identity(
                    repo_root,
                    "owner/repo#1563",
                    "1563-language-setting-follow-up",
                )

    def test_rejects_untracked_second_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            initialize_repo(repo_root, ("1563-sync-language-setting",))
            untracked = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / "1563-language-setting-follow-up"
            )
            untracked.mkdir(parents=True)
            with self.assertRaisesRegex(GitBaselineError, "multiple workspaces"):
                validate_workspace_identity(
                    repo_root,
                    "owner/repo#1563",
                    "1563-sync-language-setting",
                )

    def test_rejects_ambiguous_legacy_workspaces(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            initialize_repo(
                repo_root,
                ("1492-month-navigation", "1492-month-navigation-v2"),
            )
            with self.assertRaisesRegex(GitBaselineError, "multiple workspaces"):
                validate_workspace_identity(
                    repo_root,
                    "owner/repo#1492",
                    "1492-month-navigation",
                )

    def test_rejects_issue_number_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            initialize_repo(repo_root)
            with self.assertRaisesRegex(GitBaselineError, "1563-"):
                validate_workspace_identity(
                    repo_root,
                    "owner/repo#1563",
                    "1600-sync-language-setting",
                )

    def test_rejects_version_and_retry_markers(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            initialize_repo(repo_root)
            for workspace in (
                "1563-sync-language-setting-v2",
                "1563-v2-sync-language-setting",
                "1563-sync-language-setting-v02",
                "1563-sync-language-setting-version-3",
                "1563-sync-language-setting-cycle-2",
                "1563-sync-language-setting-retry",
                "1563-sync-language-setting-rerun-2",
            ):
                with self.subTest(workspace=workspace):
                    with self.assertRaisesRegex(GitBaselineError, "marker"):
                        validate_workspace_identity(
                            repo_root,
                            "owner/repo#1563",
                            workspace,
                        )

    def test_cli_reports_reused_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            initialize_repo(repo_root, ("1563-sync-language-setting",))
            result = subprocess.run(
                [
                    sys.executable,
                    str(VALIDATOR_PATH),
                    "--repo-root",
                    str(repo_root),
                    "--issue",
                    "owner/repo#1563",
                    "--workspace",
                    "1563-sync-language-setting",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("(reused)", result.stdout)


if __name__ == "__main__":
    unittest.main()
