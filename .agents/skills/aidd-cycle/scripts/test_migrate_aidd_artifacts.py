from __future__ import annotations

import copy
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from artifact_source import (
    SourceError,
    load_baseline_source_bytes,
    load_source,
    serialize_source,
    validate_managed_artifact_source,
)
from migrate_aidd_artifacts import (
    build_goal_source,
    migrate,
    write_regular_file_atomically,
)
from render_aidd_artifact import render_artifact_markdown
from test_structured_artifact_v2 import design_source, requirements_source


WORKSPACE = "1639-structured-data"
MARKDOWN = "# Requirements\n"
MANAGED_MARKDOWN = """# Requirements

## Requirements Input Gate

```json
{"task_context":{"source":"issue_body","issue":"owner/repo#1639","url":"https://github.com/owner/repo/issues/1639","updated_at":"2026-08-11T00:00:00Z","body_sha256":"0000000000000000000000000000000000000000000000000000000000000000"},"direct_rules":[{"id":"rule","issue_evidence":"scope","match":{"field":"topics","value":"scope"},"reason":"scope"}],"depends_on":[]}
```

## Requirements Completeness Gate

```json
{"issue_body_sha256":"0000000000000000000000000000000000000000000000000000000000000000","workspace":"1639-structured-data","baseline":{"source":"none","body_sha256":null},"requirements":[{"id":"FR-1","status":"new","issue_evidence":"scope"},{"id":"NFR-1","status":"new","issue_evidence":"scope"},{"id":"AC-1","status":"new","issue_evidence":"scope"}],"sections":[{"id":"functional","status":"new","issue_evidence":"scope"},{"id":"non_functional","status":"new","issue_evidence":"scope"},{"id":"acceptance","status":"new","issue_evidence":"scope"}],"retired":[]}
```

## 機能要件

- FR-1: 構造化本文を生成する。

## 非機能要件

- NFR-1: 二重正本を避ける。

## 受け入れ条件

- AC-1: 生成結果を確認する。

## Rule Selection

- Direct: `rule`。scope。
- Conflict: none。
"""
DESIGN_GOAL_MARKDOWN = """# Design Goal

## Goal

Designを定義する。

## Context Packet

Issue本文を扱う。
- Constraints [canonical-input]: 検証済みのcanonical requirements.jsonをread-only入力として扱う。
- Constraints [phase-boundary]: Design Goal内では実装しない。
- Stop [validation-failure]: Requirements再検証またはDesign Coverage Gateが失敗した場合は停止する。
- Stop [scope-ambiguity]: 要求ごとの設計・検証scopeを一意に決められない場合は停止する。

## Design Coverage Gate

```json
{"requirements_sha256":"0000000000000000000000000000000000000000000000000000000000000000","workspace":"1639-structured-data","requirement_ids":["FR-1","AC-1"],"baseline":{"source":"none","body_sha256":null}}
```

- FR-1 design scope: 構造化設計を定義する。
- FR-1 verification scope: 構造化検証を実行する。
- AC-1 design scope: 生成結果を確認する設計を定義する。
- AC-1 verification scope: 生成結果を確認する。
- 実装方針 baseline scope: 現在Requirementsへ再適合させる。

## Done / Verification

- [complete-scope] 全Requirements IDとbaseline sectionのDesign coverageを定義する。
- [validated-artifact] Design Coverage Gateと生成成果物の同期検証を成功させる。
"""
MANAGED_DESIGN_MARKDOWN = """# Design Doc

## 実装方針

構造化設計を定義する。

## Design Coverage Gate

```json
{"requirements_sha256":"0000000000000000000000000000000000000000000000000000000000000000","workspace":"1639-structured-data","requirement_ids":["FR-1"],"baseline":{"source":"none","body_sha256":null},"coverage":[{"id":"FR-1","design_evidence":"構造化設計を定義する。","verification_evidence":"構造化設計を確認する。"}],"baseline_sections":[]}
```
"""
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
    source_name = "requirements.json" if kind == "requirements" else "design-doc.json"
    return workspace_root / display_name, workspace_root / source_name


def initialize_repository(repo_root: Path) -> None:
    subprocess.run(["git", "init", "-q"], cwd=repo_root, check=True)
    subprocess.run(
        ["git", "config", "user.name", "AIDD Test"], cwd=repo_root, check=True
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


def managed_source(kind: str = "requirements") -> dict[str, object]:
    return copy.deepcopy(
        requirements_source() if kind == "requirements" else design_source()
    )


class MigrateAiddArtifactsTest(unittest.TestCase):
    def test_git_baseline_loader_normalizes_previous_managed_shape(self) -> None:
        previous = managed_source()

        loaded = load_baseline_source_bytes(
            serialize_source(previous).encode("utf-8"), "requirements"
        )

        self.assertNotIn("source_markdown_sha256", loaded["validation"])
        self.assertEqual(loaded, previous)

    def test_git_baseline_loader_rejects_tampered_previous_managed_inventory(self) -> None:
        previous = managed_source()
        tampered = json.loads(serialize_source(previous))
        tampered["validation"]["requirements"].pop(0)

        with self.assertRaisesRegex(SourceError, "requirements block|exactly match"):
            load_baseline_source_bytes(
                json.dumps(tampered).encode("utf-8"),
                "requirements",
            )

    def test_git_baseline_loader_accepts_current_managed_shape(self) -> None:
        current = managed_source()

        loaded = load_baseline_source_bytes(
            serialize_source(current).encode("utf-8"), "requirements"
        )

        self.assertEqual(loaded, current)

    def test_git_baseline_loader_rejects_removed_managed_v1_source(self) -> None:
        source = {
            "schema_version": 1,
            "kind": "requirements",
            "workspace": WORKSPACE,
            "display": {"path": "requirements.md", "markdown": "# Requirements\n"},
            "validation": {"mode": "managed"},
        }

        with self.assertRaisesRegex(
            SourceError, "unsupported AIDD schema_version: 1"
        ):
            load_baseline_source_bytes(
                json.dumps(source).encode("utf-8"), "requirements"
            )

    def test_regular_loader_rejects_managed_display_shadow_body(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source_path = Path(directory).resolve() / "requirements.json"
            managed = managed_source()
            managed["display"]["markdown"] = MANAGED_MARKDOWN
            with self.assertRaisesRegex(SourceError, "invalid keys"):
                serialize_source(managed)

    def test_managed_loader_requires_gate_ids_and_workspace_alignment(self) -> None:
        managed = managed_source()
        managed["validation"]["completeness_gate"]["requirements"].pop()
        with self.assertRaisesRegex(SourceError, "exactly match"):
            validate_managed_artifact_source(managed)

        managed = managed_source()
        managed["validation"]["completeness_gate"]["sections"].pop()
        with self.assertRaisesRegex(SourceError, "section IDs must exactly match"):
            validate_managed_artifact_source(managed)

        managed = managed_source()
        managed["validation"]["completeness_gate"]["workspace"] = "other"
        with self.assertRaisesRegex(SourceError, "workspace"):
            validate_managed_artifact_source(managed)

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

    def test_migration_rejects_duplicate_json_keys(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            display_path.write_text(MANAGED_MARKDOWN, encoding="utf-8")
            managed = serialize_source(
                managed_source()
            )
            managed = managed.replace(
                '"schema_version": 2,',
                '"schema_version": 2,\n  "schema_version": 2,',
                1,
            )
            source_path.write_text(managed, encoding="utf-8")
            initialize_repository(repo_root)

            with self.assertRaisesRegex(SourceError, "duplicate key"):
                migrate(repo_root)

    def test_check_accepts_managed_design_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root, "design")
            source = managed_source("design")
            display_path.write_text(
                render_artifact_markdown(source), encoding="utf-8"
            )
            source_path.write_text(serialize_source(source), encoding="utf-8")
            initialize_repository(repo_root)

            self.assertEqual(migrate(repo_root), 1)
            self.assertEqual(
                render_artifact_markdown(source).count("## Design Coverage Gate"),
                1,
            )

    def test_design_goal_import_preserves_baseline_scopes(self) -> None:
        source = build_goal_source(WORKSPACE, "design", DESIGN_GOAL_MARKDOWN)

        self.assertEqual(
            source["validation"]["baseline_scopes"],
            [
                {
                    "section_id": None,
                    "heading": "実装方針",
                    "review_scope": "現在Requirementsへ再適合させる。",
                }
            ],
        )

    def test_goal_import_rejects_contract_without_stable_ids(self) -> None:
        markdown = DESIGN_GOAL_MARKDOWN.replace(
            "- Constraints [canonical-input]:",
            "- Constraints:",
            1,
        )

        with self.assertRaisesRegex(SourceError, "must include stable IDs"):
            build_goal_source(WORKSPACE, "design", markdown)

    def test_design_goal_import_rejects_unknown_gate_fields(self) -> None:
        markdown = DESIGN_GOAL_MARKDOWN.replace(
            '"workspace":"1639-structured-data",',
            '"workspace":"1639-structured-data","unknown":true,',
        )

        with self.assertRaisesRegex(SourceError, "invalid keys"):
            build_goal_source(WORKSPACE, "design", markdown)

    def test_design_goal_import_rejects_duplicate_gate_and_scope(self) -> None:
        gate_block = DESIGN_GOAL_MARKDOWN.split(
            "- FR-1 design scope:", 1
        )[0].split("# Design Goal\n\n", 1)[1]
        duplicate_gate = DESIGN_GOAL_MARKDOWN.replace(
            "- FR-1 design scope:", f"{gate_block}- FR-1 design scope:", 1
        )
        with self.assertRaisesRegex(SourceError, "exactly once"):
            build_goal_source(WORKSPACE, "design", duplicate_gate)

        duplicate_scope = DESIGN_GOAL_MARKDOWN.replace(
            "- FR-1 verification scope:",
            "- FR-1 design scope: 重複。\n- FR-1 verification scope:",
            1,
        )
        with self.assertRaisesRegex(SourceError, "duplicate Design Goal scope"):
            build_goal_source(WORKSPACE, "design", duplicate_scope)

        extra_scope = DESIGN_GOAL_MARKDOWN + (
            "- NFR-9 design scope: Gate外。\n"
            "- NFR-9 verification scope: Gate外。\n"
        )
        with self.assertRaisesRegex(SourceError, "exactly match requirement_ids"):
            build_goal_source(WORKSPACE, "design", extra_scope)

        indented_gate = DESIGN_GOAL_MARKDOWN.replace(
            "- FR-1 design scope:",
            "   ## Design Coverage Gate\n```json\n{}\n```\n"
            "- FR-1 design scope:",
            1,
        )
        with self.assertRaisesRegex(SourceError, "exactly once"):
            build_goal_source(WORKSPACE, "design", indented_gate)

        indented_scope = DESIGN_GOAL_MARKDOWN.replace(
            "- FR-1 verification scope:",
            "   - FR-1 design scope: 重複。\n"
            "- FR-1 verification scope:",
            1,
        )
        with self.assertRaisesRegex(SourceError, "duplicate Design Goal scope"):
            build_goal_source(WORKSPACE, "design", indented_scope)

    def test_design_goal_import_ignores_hidden_gate_and_scope_examples(self) -> None:
        hidden_example = (
            "~~~~markdown\n"
            "## Design Coverage Gate\n```json\n{}\n```\n"
            "- FR-1 design scope: 非表示の例。\n"
            "~~~~\n\n"
        )

        source = build_goal_source(
            WORKSPACE,
            "design",
            hidden_example + DESIGN_GOAL_MARKDOWN,
        )

        self.assertEqual(len(source["validation"]["scopes"]), 2)

    def test_load_source_rejects_invalid_nested_managed_schema(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source_path = Path(directory).resolve() / "requirements.json"
            managed = managed_source()
            managed["validation"]["completeness_gate"]["baseline"]["extra"] = True
            source_path.write_text(
                json.dumps(managed, ensure_ascii=False), encoding="utf-8"
            )

            with self.assertRaisesRegex(SourceError, "baseline has invalid keys"):
                load_source(source_path, "requirements")

    def test_historical_markdown_only_workspace_is_ignored(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, _ = artifact_paths(repo_root)
            display_path.write_text(MARKDOWN, encoding="utf-8")
            initialize_repository(repo_root)

            self.assertEqual(migrate(repo_root), 0)

    def test_check_rejects_missing_managed_source_from_git_head(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            source = managed_source()
            display_path.write_text(
                render_artifact_markdown(source),
                encoding="utf-8",
            )
            source_path.write_text(serialize_source(source), encoding="utf-8")
            initialize_repository(repo_root)

            source_path.unlink()

            with self.assertRaisesRegex(SourceError, "artifact source is missing"):
                migrate(repo_root)

    def test_check_accepts_crlf_and_lf_as_the_same_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            source = managed_source()
            display_path.write_bytes(
                render_artifact_markdown(source).replace("\n", "\r\n").encode()
            )
            source_path.write_text(serialize_source(source), encoding="utf-8")
            initialize_repository(repo_root)

            self.assertEqual(migrate(repo_root), 1)

    def test_check_rejects_v1_sidecar(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            display_path.write_text(MARKDOWN, encoding="utf-8")
            source_path.write_text(
                json.dumps(
                    {
                        "schema_version": 1,
                        "kind": "requirements",
                        "workspace": WORKSPACE,
                        "display": {
                            "path": "requirements.md",
                            "markdown": MARKDOWN,
                        },
                        "validation": {"mode": "legacy_import"},
                    }
                ),
                encoding="utf-8",
            )
            initialize_repository(repo_root)

            with self.assertRaisesRegex(
                SourceError, "unsupported AIDD schema_version: 1"
            ):
                migrate(repo_root)

    def test_check_rejects_orphan_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            source = managed_source()
            source_path.write_text(
                serialize_source(source),
                encoding="utf-8",
            )
            initialize_repository(repo_root)

            with self.assertRaisesRegex(SourceError, "display is missing"):
                migrate(repo_root)

            self.assertFalse(display_path.exists())

    def test_check_rejects_symlinked_workspace(self) -> None:
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
            (outside_workspace / "requirements.md").write_text(
                MARKDOWN,
                encoding="utf-8",
            )
            (workspaces_root / WORKSPACE).symlink_to(
                outside_workspace,
                target_is_directory=True,
            )

            with self.assertRaisesRegex(SourceError, "must not contain symlinks"):
                migrate(repo_root)

            self.assertFalse((outside_workspace / "requirements.json").exists())

    def test_check_rejects_incomplete_managed_schema(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            display_path.write_text(MANAGED_MARKDOWN, encoding="utf-8")
            managed = managed_source()
            managed["validation"]["input_gate"].pop("task_context")
            source_path.write_text(
                json.dumps(managed, ensure_ascii=False), encoding="utf-8"
            )
            initialize_repository(repo_root)

            with self.assertRaisesRegex(SourceError, "input_gate has invalid keys"):
                migrate(repo_root)


if __name__ == "__main__":
    unittest.main()
