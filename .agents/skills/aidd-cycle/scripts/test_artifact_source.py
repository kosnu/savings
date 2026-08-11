from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

from artifact_source import SourceError, load_source, serialize_source, validate_source
from render_aidd_artifact import check_all, check_or_write


WORKSPACE = "1639-structured-data"


def initialize_repository(repo_root: Path) -> None:
    subprocess.run(
        ["git", "init", "--quiet"],
        cwd=repo_root,
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "config", "user.name", "AIDD Test"],
        cwd=repo_root,
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "config", "user.email", "aidd@example.com"],
        cwd=repo_root,
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "commit", "--allow-empty", "--quiet", "-m", "baseline"],
        cwd=repo_root,
        check=True,
        capture_output=True,
    )


def source() -> dict[str, object]:
    return {
        "schema_version": 1,
        "kind": "requirements",
        "workspace": WORKSPACE,
        "display": {"path": "requirements.md", "markdown": "# Requirements\n"},
        "validation": {"mode": "managed"},
    }


class ArtifactSourceTest(unittest.TestCase):
    def test_rejects_unknown_envelope_key(self) -> None:
        value = source()
        value["unexpected"] = True
        with self.assertRaisesRegex(SourceError, "must contain only"):
            validate_source(value)

    def test_rejects_display_path_for_other_kind(self) -> None:
        value = source()
        value["display"]["path"] = "design-doc.md"
        with self.assertRaisesRegex(SourceError, "display.path"):
            validate_source(value)

    def test_rejects_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "requirements.json"
            path.write_text("{invalid", encoding="utf-8")
            with self.assertRaisesRegex(SourceError, "JSON is invalid"):
                load_source(path)

    def test_renderer_detects_stale_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            root.mkdir(parents=True)
            source_path = root / "requirements.json"
            output_path = root / "requirements.md"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            output_path.write_text("# stale\n", encoding="utf-8")
            with self.assertRaisesRegex(SourceError, "stale"):
                check_or_write(source_path, output_path, True, repo_root)

    def test_renderer_accepts_crlf_for_lf_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            root.mkdir(parents=True)
            source_path = root / "requirements.json"
            output_path = root / "requirements.md"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            output_path.write_bytes(b"# Requirements\r\n")

            check_or_write(source_path, output_path, True, repo_root)

    def test_renderer_accepts_lf_for_crlf_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            root.mkdir(parents=True)
            source_value = source()
            source_value["display"]["markdown"] = "# Requirements\r\n"
            source_path = root / "requirements.json"
            output_path = root / "requirements.md"
            source_path.write_text(serialize_source(source_value), encoding="utf-8")
            output_path.write_bytes(b"# Requirements\n")

            check_or_write(source_path, output_path, True, repo_root)

    def test_renderer_rejects_lone_cr_as_lf(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            root.mkdir(parents=True)
            source_path = root / "requirements.json"
            output_path = root / "requirements.md"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            output_path.write_bytes(b"# Requirements\r")

            with self.assertRaisesRegex(SourceError, "stale"):
                check_or_write(source_path, output_path, True, repo_root)

    def test_renderer_rejects_non_git_repo_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            root.mkdir(parents=True)
            source_path = root / "requirements.json"
            output_path = root / "requirements.md"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            output_path.write_text("# Requirements\n", encoding="utf-8")

            with self.assertRaisesRegex(SourceError, "not a readable Git worktree"):
                check_or_write(source_path, output_path, True, repo_root)

    def test_renderer_rejects_symlinked_repo_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            temporary_root = Path(directory).resolve()
            repo_root = temporary_root / "repo"
            repo_root.mkdir()
            initialize_repository(repo_root)
            symlink_root = temporary_root / "repo-alias"
            symlink_root.symlink_to(repo_root, target_is_directory=True)
            root = (
                symlink_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            root.mkdir(parents=True)
            source_path = root / "requirements.json"
            output_path = root / "requirements.md"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            output_path.write_text("# Requirements\n", encoding="utf-8")

            with self.assertRaisesRegex(SourceError, "must not contain symlinks"):
                check_or_write(source_path, output_path, True, symlink_root)

    def test_renderer_rejects_noncanonical_artifact_output(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            workspace_root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            workspace_root.mkdir(parents=True)
            source_path = workspace_root / "requirements.json"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            with self.assertRaisesRegex(SourceError, "output must be canonical"):
                check_or_write(
                    source_path,
                    repo_root / "temporary.md",
                    True,
                    repo_root,
                )

    def test_renderer_rejects_noncanonical_artifact_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            source_path = repo_root / "temporary.json"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            with self.assertRaisesRegex(SourceError, "source must be canonical"):
                check_or_write(
                    source_path,
                    repo_root
                    / "docs"
                    / "ai-driven-development"
                    / "workspaces"
                    / WORKSPACE
                    / "requirements.md",
                    True,
                    repo_root,
                )

    def test_renderer_requires_repo_root_for_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source_path = root / "requirements.json"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            with self.assertRaisesRegex(SourceError, "requires --repo-root"):
                check_or_write(source_path, root / "requirements.md", True)

    def test_check_all_rejects_kind_filename_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            workspace_root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            workspace_root.mkdir(parents=True)
            wrong_path = workspace_root / "design.json"
            wrong_path.write_text(serialize_source(source()), encoding="utf-8")
            (workspace_root / "requirements.md").write_text(
                "# Requirements\n", encoding="utf-8"
            )
            with self.assertRaisesRegex(SourceError, "requirements.json"):
                check_all(repo_root)

    def test_check_all_rejects_missing_artifact_source(self) -> None:
        for display_filename in ("requirements.md", "design-doc.md"):
            with self.subTest(display_filename=display_filename):
                with tempfile.TemporaryDirectory() as directory:
                    repo_root = Path(directory).resolve()
                    initialize_repository(repo_root)
                    workspace_root = (
                        repo_root
                        / "docs"
                        / "ai-driven-development"
                        / "workspaces"
                        / WORKSPACE
                    )
                    workspace_root.mkdir(parents=True)
                    (workspace_root / display_filename).write_text(
                        "# Artifact\n", encoding="utf-8"
                    )

                    with self.assertRaisesRegex(SourceError, "source is missing"):
                        check_all(repo_root)


if __name__ == "__main__":
    unittest.main()
