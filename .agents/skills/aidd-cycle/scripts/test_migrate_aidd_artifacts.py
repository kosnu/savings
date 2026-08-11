from __future__ import annotations

import copy
import tempfile
import unittest
from pathlib import Path

from artifact_source import SourceError, serialize_source
from migrate_aidd_artifacts import build_goal_source, build_source, migrate
from render_aidd_artifact import render_artifact_markdown


WORKSPACE = "1639-structured-data"
MARKDOWN = "# Requirements\n"
MANAGED_MARKDOWN = """# Requirements

## Requirements Input Gate

```json
{"direct_rules":[],"depends_on":[]}
```

## Requirements Completeness Gate

```json
{}
```

## 機能要件

- FR-1: 構造化本文を生成する。

## 非機能要件

- NFR-1: 二重正本を避ける。

## 受け入れ条件

- AC-1: 生成結果を確認する。

## Rule Selection

- Conflict: none。
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
MANAGED_DESIGN_MARKDOWN = """# Design Doc

## 実装方針

構造化設計を定義する。

## Design Coverage Gate

```json
{"requirement_ids":["FR-1"]}
```
"""
LEGACY_DESIGN_MARKDOWN = "# Design Doc\n"


def artifact_paths(
    repo_root: Path, kind: str = "requirements"
) -> tuple[Path, Path]:
    workspace_root = (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / WORKSPACE
    )
    workspace_root.mkdir(parents=True)
    display_name = "requirements.md" if kind == "requirements" else "design-doc.md"
    source_name = "requirements.json" if kind == "requirements" else "design.json"
    return workspace_root / display_name, workspace_root / source_name


class MigrateAiddArtifactsTest(unittest.TestCase):
    def test_check_accepts_managed_and_legacy_design_sources(self) -> None:
        for markdown in (MANAGED_DESIGN_MARKDOWN, LEGACY_DESIGN_MARKDOWN):
            with self.subTest(managed="Design Coverage Gate" in markdown):
                with tempfile.TemporaryDirectory() as directory:
                    repo_root = Path(directory)
                    display_path, source_path = artifact_paths(repo_root, "design")
                    display_path.write_text(markdown, encoding="utf-8")
                    source = build_source(WORKSPACE, "design", markdown)
                    source_path.write_text(serialize_source(source), encoding="utf-8")

                    self.assertEqual(migrate(repo_root, False), 1)
                    if source["validation"]["mode"] == "managed":
                        rendered = render_artifact_markdown(source)
                        self.assertEqual(rendered.count("## Design Coverage Gate"), 1)

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
            self.assertNotIn("## Requirements Input Gate", managed["display"]["markdown"])
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

            with self.assertRaisesRegex(SourceError, "validation gate"):
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

    def test_check_accepts_crlf_and_lf_as_the_same_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            display_path, source_path = artifact_paths(repo_root)
            display_path.write_bytes(b"# Requirements\r\n")
            legacy = build_source(WORKSPACE, "requirements", MARKDOWN)
            source_path.write_text(serialize_source(legacy), encoding="utf-8")

            self.assertEqual(migrate(repo_root, False), 1)


if __name__ == "__main__":
    unittest.main()
