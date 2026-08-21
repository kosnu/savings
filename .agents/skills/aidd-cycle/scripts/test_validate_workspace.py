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
    canonical_workspace_name,
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

    def test_derives_first_workspace_from_the_complete_normalized_title(self) -> None:
        self.assertEqual(
            canonical_workspace_name(
                "owner/repo#1563",
                "  Sync Language Setting / 言語設定  ",
            ),
            "1563-sync-language-setting-86153b5ef15b",
        )

    def test_accepts_only_the_issue_derived_first_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            issue_title = "Sync Language Setting / 言語設定"
            workspace = canonical_workspace_name(
                "owner/repo#1563", issue_title
            )
            existing = validate_workspace_identity(
                repo_root,
                "owner/repo#1563",
                workspace,
                issue_title,
            )
        self.assertEqual(existing, [])

    def test_rejects_arbitrary_first_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            with self.assertRaisesRegex(GitBaselineError, "canonical Issue-derived"):
                validate_workspace_identity(
                    repo_root,
                    "owner/repo#1563",
                    "1563-sync-language-setting-attempt-2",
                    "Sync Language Setting / 言語設定",
                )

    def test_requires_issue_title_for_first_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            with self.assertRaisesRegex(GitBaselineError, "issue title is required"):
                validate_workspace_identity(
                    repo_root,
                    "owner/repo#1563",
                    "1563-sync-language-setting",
                )

    def test_untracked_directory_does_not_establish_arbitrary_identity(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / "1563-sync-language-setting-attempt-2"
            ).mkdir(parents=True)
            with self.assertRaisesRegex(GitBaselineError, "issue title is required"):
                validate_workspace_identity(
                    repo_root,
                    "owner/repo#1563",
                    "1563-sync-language-setting-attempt-2",
                )

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
                    "--issue-title",
                    "Changed title does not rename an existing workspace",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("(reused)", result.stdout)

    def test_cli_derives_the_first_workspace_without_a_candidate_name(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            result = subprocess.run(
                [
                    sys.executable,
                    str(VALIDATOR_PATH),
                    "--repo-root",
                    str(repo_root),
                    "--issue",
                    "owner/repo#1563",
                    "--issue-title",
                    "Sync Language Setting / 言語設定",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("1563-sync-language-setting-86153b5ef15b (new)", result.stdout)

    def test_cli_accepts_an_empty_canonical_workspace_directory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            workspace = "1563-sync-language-setting-86153b5ef15b"
            (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / workspace
            ).mkdir(parents=True)
            result = subprocess.run(
                [
                    sys.executable,
                    str(VALIDATOR_PATH),
                    "--repo-root",
                    str(repo_root),
                    "--issue",
                    "owner/repo#1563",
                    "--issue-title",
                    "Sync Language Setting / 言語設定",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f"{workspace} (reused)", result.stdout)

    def test_cli_rejects_an_empty_arbitrary_workspace_directory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / "1563-sync-language-setting-attempt-2"
            ).mkdir(parents=True)
            result = subprocess.run(
                [
                    sys.executable,
                    str(VALIDATOR_PATH),
                    "--repo-root",
                    str(repo_root),
                    "--issue",
                    "owner/repo#1563",
                    "--issue-title",
                    "Sync Language Setting / 言語設定",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 1)
        self.assertIn("canonical Issue-derived name", result.stderr)


if __name__ == "__main__":
    unittest.main()
