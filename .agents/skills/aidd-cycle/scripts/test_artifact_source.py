from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from artifact_source import (
    SourceError,
    inventory_owned_paths,
    load_source,
    load_source_bytes,
    serialize_source,
    validate_managed_artifact_source,
    write_regular_file_atomically,
)
from render_aidd_artifact import check_all, render_artifact_markdown
from test_structured_artifact_v2 import design_source, requirements_source


WORKSPACE = "1639-structured-data"


def artifact_paths(
    repo_root: Path,
    kind: str = "requirements",
) -> tuple[Path, Path]:
    workspace_root = (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / WORKSPACE
    )
    workspace_root.mkdir(parents=True)
    if kind == "requirements":
        return workspace_root / "requirements.md", workspace_root / "requirements.json"
    return workspace_root / "design-doc.md", workspace_root / "design-doc.json"


def initialize_repository(repo_root: Path) -> None:
    subprocess.run(["git", "init", "-q"], cwd=repo_root, check=True)
    subprocess.run(
        ["git", "config", "user.name", "AIDD Test"],
        cwd=repo_root,
        check=True,
    )
    subprocess.run(
        ["git", "config", "user.email", "aidd@example.com"],
        cwd=repo_root,
        check=True,
    )
    subprocess.run(["git", "add", "."], cwd=repo_root, check=True)
    subprocess.run(
        ["git", "commit", "--allow-empty", "-qm", "baseline"],
        cwd=repo_root,
        check=True,
    )


class ArtifactSourceTest(unittest.TestCase):
    def test_managed_source_round_trip_uses_current_shape(self) -> None:
        source = requirements_source()

        loaded = load_source_bytes(
            serialize_source(source).encode("utf-8"),
            "requirements",
        )

        self.assertEqual(loaded, source)

    def test_rejects_removed_schema_v1(self) -> None:
        source = {
            "schema_version": 1,
            "kind": "requirements",
            "workspace": WORKSPACE,
            "display": {"path": "requirements.md", "markdown": "# Requirements\n"},
            "validation": {"mode": "managed"},
        }

        with self.assertRaisesRegex(SourceError, "unsupported AIDD schema_version: 1"):
            load_source_bytes(json.dumps(source).encode("utf-8"), "requirements")

    def test_rejects_managed_display_shadow_body(self) -> None:
        source = requirements_source()
        source["display"]["markdown"] = "# shadow"

        with self.assertRaisesRegex(SourceError, "invalid keys"):
            serialize_source(source)

    def test_requires_gate_inventory_and_workspace_alignment(self) -> None:
        source = requirements_source()
        source["validation"]["completeness_gate"]["requirements"].pop()
        with self.assertRaisesRegex(SourceError, "exactly match"):
            validate_managed_artifact_source(source)

        source = requirements_source()
        source["validation"]["completeness_gate"]["sections"].pop()
        with self.assertRaisesRegex(SourceError, "section IDs must exactly match"):
            validate_managed_artifact_source(source)

        source = requirements_source()
        source["validation"]["completeness_gate"]["workspace"] = "other"
        with self.assertRaisesRegex(SourceError, "workspace"):
            validate_managed_artifact_source(source)

    def test_atomic_writer_replaces_symlink_without_following_it(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            outside = root / "outside.json"
            outside.write_text("outside", encoding="utf-8")
            destination = root / "requirements.json"
            destination.symlink_to(outside)

            write_regular_file_atomically(destination, "replacement")

            self.assertFalse(destination.is_symlink())
            self.assertEqual(destination.read_text(encoding="utf-8"), "replacement")
            self.assertEqual(outside.read_text(encoding="utf-8"), "outside")

    def test_atomic_writer_rejects_symlinked_directory_component(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            outside = root / "outside"
            outside.mkdir()
            alias = root / "alias"
            alias.symlink_to(outside, target_is_directory=True)

            with self.assertRaises(OSError):
                write_regular_file_atomically(alias / "requirements.json", "data")

            self.assertFalse((outside / "requirements.json").exists())

    def test_inventory_rejects_symlinked_ownership_ancestor(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            outside = root / "outside"
            outside.mkdir()
            (outside / "feature.ts").write_text("export {};\n", encoding="utf-8")
            (root / "apps").symlink_to(outside, target_is_directory=True)

            with self.assertRaisesRegex(SourceError, "must not contain symlinks"):
                inventory_owned_paths(
                    root,
                    {
                        "ownership_scopes": [
                            {"path": "apps/feature.ts", "kind": "file"}
                        ]
                    },
                )

    def test_loader_rejects_invalid_nested_schema(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source_path = Path(directory).resolve() / "requirements.json"
            source = requirements_source()
            source["validation"]["completeness_gate"]["baseline"]["extra"] = True
            source_path.write_text(
                json.dumps(source, ensure_ascii=False),
                encoding="utf-8",
            )

            with self.assertRaisesRegex(SourceError, "baseline has invalid keys"):
                load_source(source_path, "requirements")

    def test_check_all_accepts_managed_design_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root, "design")
            source = design_source()
            display_path.write_text(
                render_artifact_markdown(source),
                encoding="utf-8",
            )
            source_path.write_text(serialize_source(source), encoding="utf-8")
            initialize_repository(repo_root)

            self.assertEqual(check_all(repo_root), 1)

    def test_check_all_ignores_historical_markdown_only_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, _ = artifact_paths(repo_root)
            display_path.write_text("# historical\n", encoding="utf-8")
            initialize_repository(repo_root)

            self.assertEqual(check_all(repo_root), 0)

    def test_check_all_rejects_orphan_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            _, source_path = artifact_paths(repo_root)
            source_path.write_text(
                serialize_source(requirements_source()),
                encoding="utf-8",
            )
            initialize_repository(repo_root)

            with self.assertRaisesRegex(SourceError, "generated Markdown is missing"):
                check_all(repo_root)

    def test_check_all_rejects_symlinked_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            temporary_root = Path(directory).resolve()
            repo_root = temporary_root / "repo"
            repo_root.mkdir()
            initialize_repository(repo_root)
            workspaces_root = (
                repo_root / "docs" / "ai-driven-development" / "workspaces"
            )
            workspaces_root.mkdir(parents=True)
            outside_workspace = temporary_root / "outside-workspace"
            outside_workspace.mkdir()
            (outside_workspace / "requirements.json").write_text(
                serialize_source(requirements_source()),
                encoding="utf-8",
            )
            (workspaces_root / WORKSPACE).symlink_to(
                outside_workspace,
                target_is_directory=True,
            )

            with self.assertRaisesRegex(SourceError, "must not contain symlinks"):
                check_all(repo_root)


if __name__ == "__main__":
    unittest.main()
