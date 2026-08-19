from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path

import git_baseline

from git_baseline import (
    GitBaselineError,
    load_git_head_source,
    validate_workspace_identity,
)


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
    def test_accepts_executable_regular_git_head_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            source_path = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / "1639-structured-data"
                / "requirements.json"
            )
            source_path.parent.mkdir(parents=True)
            source_path.write_bytes(b"regular blob")
            source_path.chmod(0o755)
            run_git(repo_root, "add", str(source_path.relative_to(repo_root)))
            run_git(repo_root, "commit", "-qm", "executable regular source")

            _, content = load_git_head_source(
                repo_root, "1639-structured-data", "requirements"
            )

            self.assertEqual(content, b"regular blob")

    def test_ignores_legacy_design_source_after_filename_migration(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            source_path = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / "1639-structured-data"
                / "design.json"
            )
            source_path.parent.mkdir(parents=True)
            source_path.write_bytes(b"legacy design source")
            run_git(repo_root, "add", str(source_path.relative_to(repo_root)))
            run_git(repo_root, "commit", "-qm", "legacy design source")

            _, content = load_git_head_source(
                repo_root, "1639-structured-data", "design"
            )

            self.assertIsNone(content)

    def test_rejects_git_head_source_symlink_entry(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            source_path = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / "1639-structured-data"
                / "requirements.json"
            )
            source_path.parent.mkdir(parents=True)
            source_path.symlink_to('{"schema_version":1}')
            run_git(repo_root, "add", str(source_path.relative_to(repo_root)))
            run_git(repo_root, "commit", "-qm", "symlink source")

            with self.assertRaisesRegex(GitBaselineError, "regular file"):
                load_git_head_source(repo_root, "1639-structured-data", "requirements")

    def test_rejects_git_head_source_over_size_limit_before_read(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            source_path = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / "1639-structured-data"
                / "requirements.json"
            )
            source_path.parent.mkdir(parents=True)
            source_path.write_bytes(b"oversized")
            run_git(repo_root, "add", str(source_path.relative_to(repo_root)))
            run_git(repo_root, "commit", "-qm", "oversized source")

            with mock.patch.object(git_baseline, "MAX_GIT_BLOB_BYTES", 4):
                with self.assertRaisesRegex(GitBaselineError, "exceeds"):
                    load_git_head_source(
                        repo_root, "1639-structured-data", "requirements"
                    )

    def test_accepts_first_unversioned_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            existing = validate_workspace_identity(
                repo_root,
                "owner/repo#1563",
                "1563-sync-language-setting",
            )
        self.assertEqual(existing, [])

    def test_reuses_the_only_existing_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root, ("1563-sync-language-setting",))
            existing = validate_workspace_identity(
                repo_root,
                "owner/repo#1563",
                "1563-sync-language-setting",
            )
        self.assertEqual(existing, ["1563-sync-language-setting"])

    def test_rejects_a_second_workspace_for_the_same_issue(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root, ("1563-sync-language-setting",))
            with self.assertRaisesRegex(GitBaselineError, "reuse"):
                validate_workspace_identity(
                    repo_root,
                    "owner/repo#1563",
                    "1563-language-setting-follow-up",
                )

    def test_rejects_untracked_second_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
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
            repo_root = Path(directory).resolve()
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
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            with self.assertRaisesRegex(GitBaselineError, "1563-"):
                validate_workspace_identity(
                    repo_root,
                    "owner/repo#1563",
                    "1600-sync-language-setting",
                )

    def test_rejects_version_and_retry_markers(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
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
            repo_root = Path(directory).resolve()
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
