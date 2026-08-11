from __future__ import annotations

import copy
import tempfile
import unittest
from pathlib import Path

from artifact_source import SourceError, serialize_source
from migrate_aidd_artifacts import build_goal_source, build_source, migrate


WORKSPACE = "1639-structured-data"
MARKDOWN = "# Requirements\n"
MANAGED_MARKDOWN = """# Requirements

## Requirements Input Gate

```json
{}
```

## Requirements Completeness Gate

```json
{}
```
"""
DESIGN_GOAL_MARKDOWN = """# Design Goal

## Design Coverage Gate

```json
{"requirement_ids":["FR-1"]}
```

- FR-1 design scope: 構造化設計を定義する。
- FR-1 verification scope: 構造化検証を実行する。
- 実装方針 baseline scope: 現在Requirementsへ再適合させる。
"""


def artifact_paths(repo_root: Path) -> tuple[Path, Path]:
    workspace_root = (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / WORKSPACE
    )
    workspace_root.mkdir(parents=True)
    return workspace_root / "requirements.md", workspace_root / "requirements.json"


class MigrateAiddArtifactsTest(unittest.TestCase):
    def test_design_goal_import_preserves_baseline_scopes(self) -> None:
        source = build_goal_source(WORKSPACE, "design", DESIGN_GOAL_MARKDOWN)

        self.assertEqual(
            source["validation"]["baseline_scopes"],
            [
                {
                    "heading": "実装方針",
                    "review_scope": (
                        "実装方針 baseline scope: 現在Requirementsへ再適合させる。"
                    ),
                }
            ],
        )

    def test_write_preserves_existing_managed_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            display_path, source_path = artifact_paths(repo_root)
            display_path.write_text(MANAGED_MARKDOWN, encoding="utf-8")
            managed = build_source(WORKSPACE, "requirements", MANAGED_MARKDOWN)
            managed["validation"]["managed_evidence"] = "preserve"
            serialized = serialize_source(managed)
            source_path.write_text(serialized, encoding="utf-8")

            migrate(repo_root, True)

            self.assertEqual(source_path.read_text(encoding="utf-8"), serialized)

    def test_check_rejects_tampered_legacy_inventory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            display_path, source_path = artifact_paths(repo_root)
            display_path.write_text(MARKDOWN, encoding="utf-8")
            legacy = build_source(WORKSPACE, "requirements", MARKDOWN)
            tampered = copy.deepcopy(legacy)
            tampered["validation"]["mode"] = "managed"
            tampered["validation"]["requirements"] = [
                {"id": "FR-1", "content": "tampered"}
            ]
            source_path.write_text(serialize_source(tampered), encoding="utf-8")

            with self.assertRaisesRegex(SourceError, "legacy import differs"):
                migrate(repo_root, False)

    def test_write_never_downgrades_existing_managed_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            display_path, source_path = artifact_paths(repo_root)
            managed = build_source(WORKSPACE, "requirements", MANAGED_MARKDOWN)
            serialized = serialize_source(managed)
            source_path.write_text(serialized, encoding="utf-8")
            display_path.write_text(MARKDOWN, encoding="utf-8")

            with self.assertRaisesRegex(SourceError, "round-trip mismatch"):
                migrate(repo_root, True)

            self.assertEqual(source_path.read_text(encoding="utf-8"), serialized)

    def test_check_accepts_exact_legacy_inventory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            display_path, source_path = artifact_paths(repo_root)
            display_path.write_text(MARKDOWN, encoding="utf-8")
            legacy = build_source(WORKSPACE, "requirements", MARKDOWN)
            source_path.write_text(serialize_source(legacy), encoding="utf-8")

            self.assertEqual(migrate(repo_root, False), 1)


if __name__ == "__main__":
    unittest.main()
