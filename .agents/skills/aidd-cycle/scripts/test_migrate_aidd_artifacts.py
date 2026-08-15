from __future__ import annotations

import copy
import hashlib
import json
import os
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
    build_source,
    migrate,
    regular_file_matches,
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
- Constraints: JSONを正本にする。
- Stop: scopeが変わる場合。

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

Design coverageを確認する。
"""
MANAGED_DESIGN_MARKDOWN = """# Design Doc

## 実装方針

構造化設計を定義する。

## Design Coverage Gate

```json
{"requirements_sha256":"0000000000000000000000000000000000000000000000000000000000000000","workspace":"1639-structured-data","requirement_ids":["FR-1"],"baseline":{"source":"none","body_sha256":null},"coverage":[{"id":"FR-1","design_evidence":"構造化設計を定義する。","verification_evidence":"構造化設計を確認する。"}],"baseline_sections":[]}
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

    def test_regular_loader_rejects_managed_display_shadow_body(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source_path = Path(directory).resolve() / "requirements.json"
            managed = managed_source()
            managed["display"]["markdown"] = MANAGED_MARKDOWN
            with self.assertRaisesRegex(SourceError, "invalid keys"):
                serialize_source(managed)

    def test_legacy_baseline_loader_rejects_tampered_inventory(self) -> None:
        requirements = build_source(WORKSPACE, "requirements", MARKDOWN)
        requirements["validation"]["requirements"] = [
            {"id": "FR-9", "content": "- FR-9: tampered"}
        ]
        with self.assertRaisesRegex(SourceError, "requirements inventory mismatch"):
            load_baseline_source_bytes(
                serialize_source(requirements).encode("utf-8"),
                "requirements",
            )

        design = build_source(WORKSPACE, "design", LEGACY_DESIGN_MARKDOWN)
        design["validation"]["sections"] = [
            {"heading": "tampered", "content": "## tampered"}
        ]
        with self.assertRaisesRegex(SourceError, "design inventory mismatch"):
            load_baseline_source_bytes(
                serialize_source(design).encode("utf-8"),
                "design",
            )

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

    def test_regular_file_comparison_does_not_follow_destination_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            outside = root / "outside.json"
            outside.write_text("same", encoding="utf-8")
            destination = root / "requirements.json"
            destination.symlink_to(outside)

            self.assertFalse(regular_file_matches(destination, "same"))

            write_regular_file_atomically(destination, "same")
            self.assertFalse(destination.is_symlink())
            self.assertEqual(outside.read_text(encoding="utf-8"), "same")

    def test_regular_file_comparison_rejects_fifo_without_blocking(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory).resolve() / "requirements.json"
            os.mkfifo(destination)

            self.assertFalse(regular_file_matches(destination, "same"))

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
                migrate(repo_root, False)

    def test_check_accepts_managed_and_legacy_design_sources(self) -> None:
        for markdown in (MANAGED_DESIGN_MARKDOWN, LEGACY_DESIGN_MARKDOWN):
            with self.subTest(managed="Design Coverage Gate" in markdown):
                with tempfile.TemporaryDirectory() as directory:
                    repo_root = Path(directory).resolve()
                    display_path, source_path = artifact_paths(repo_root, "design")
                    display_path.write_text(markdown, encoding="utf-8")
                    source = build_source(WORKSPACE, "design", markdown)
                    source_path.write_text(serialize_source(source), encoding="utf-8")
                    initialize_repository(repo_root)

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
                    "section_id": None,
                    "heading": "実装方針",
                    "review_scope": "現在Requirementsへ再適合させる。",
                }
            ],
        )

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

    def test_write_normalizes_existing_managed_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            managed = managed_source()
            display_path.write_text(
                render_artifact_markdown(managed), encoding="utf-8"
            )
            source_path.write_text(serialize_source(managed), encoding="utf-8")
            initialize_repository(repo_root)

            migrate(repo_root, True)

            normalized = managed_source()
            self.assertEqual(
                source_path.read_text(encoding="utf-8"),
                serialize_source(normalized),
            )

    def test_check_rejects_tampered_legacy_inventory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            display_path.write_text(MARKDOWN, encoding="utf-8")
            legacy = build_source(WORKSPACE, "requirements", MARKDOWN)
            tampered = copy.deepcopy(legacy)
            tampered["validation"]["requirements"] = [
                {"id": "FR-1", "content": "- FR-1: tampered"}
            ]
            inventory = {
                "requirements": tampered["validation"]["requirements"],
                "sections": tampered["validation"]["sections"],
            }
            tampered["validation"]["inventory_sha256"] = hashlib.sha256(
                json.dumps(
                    inventory,
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                ).encode("utf-8")
            ).hexdigest()
            source_path.write_text(
                serialize_source(tampered), encoding="utf-8"
            )
            initialize_repository(repo_root)

            with self.assertRaisesRegex(
                SourceError, "legacy import differs from source Markdown"
            ):
                migrate(repo_root, False)

    def test_check_rejects_coordinated_legacy_markdown_and_inventory_change(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            legacy = build_source(WORKSPACE, "requirements", MARKDOWN)
            display_path.write_text(MARKDOWN, encoding="utf-8")
            source_path.write_text(serialize_source(legacy), encoding="utf-8")
            initialize_repository(repo_root)

            changed_markdown = "# Requirements\n\n変更後。\n"
            changed = build_source(WORKSPACE, "requirements", changed_markdown)
            display_path.write_text(changed_markdown, encoding="utf-8")
            source_path.write_text(serialize_source(changed), encoding="utf-8")

            with self.assertRaisesRegex(
                SourceError, "legacy Git HEAD source is immutable"
            ):
                migrate(repo_root, False)

    def test_write_never_downgrades_existing_managed_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            managed = managed_source()
            serialized = serialize_source(managed)
            source_path.write_text(serialized, encoding="utf-8")
            display_path.write_text(MARKDOWN, encoding="utf-8")
            initialize_repository(repo_root)

            with self.assertRaisesRegex(SourceError, "round-trip mismatch"):
                migrate(repo_root, True)

            self.assertEqual(source_path.read_text(encoding="utf-8"), serialized)

    def test_rejects_downgrade_of_managed_git_head_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            managed = managed_source()
            display_path.write_text(
                render_artifact_markdown(managed),
                encoding="utf-8",
            )
            source_path.write_text(serialize_source(managed), encoding="utf-8")
            initialize_repository(repo_root)

            display_path.write_text(MARKDOWN, encoding="utf-8")
            legacy = build_source(WORKSPACE, "requirements", MARKDOWN)
            source_path.write_text(serialize_source(legacy), encoding="utf-8")

            with self.assertRaisesRegex(
                SourceError,
                "managed Git HEAD source cannot be downgraded",
            ):
                migrate(repo_root, False)

    def test_write_rejects_missing_managed_git_head_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            managed = managed_source()
            display_path.write_text(
                render_artifact_markdown(managed),
                encoding="utf-8",
            )
            source_path.write_text(serialize_source(managed), encoding="utf-8")
            initialize_repository(repo_root)

            source_path.unlink()
            display_path.write_text(
                render_artifact_markdown(managed).replace(
                    "構造化本文を生成する。",
                    "Markdownから再生成する。",
                    1,
                ),
                encoding="utf-8",
            )

            with self.assertRaisesRegex(
                SourceError,
                "Git HEAD source is missing from worktree",
            ):
                migrate(repo_root, True)

            self.assertFalse(source_path.exists())

    def test_write_rejects_missing_legacy_git_head_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            legacy = build_source(WORKSPACE, "requirements", MARKDOWN)
            display_path.write_text(MARKDOWN, encoding="utf-8")
            source_path.write_text(serialize_source(legacy), encoding="utf-8")
            initialize_repository(repo_root)

            source_path.unlink()
            display_path.write_text(
                "# Requirements\n\nFR-9: Markdownから再生成する。\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(
                SourceError,
                "Git HEAD source is missing from worktree",
            ):
                migrate(repo_root, True)

            self.assertFalse(source_path.exists())

    def test_rejects_requirements_markdown_with_only_one_managed_gate(self) -> None:
        gate_start = MANAGED_MARKDOWN.index("## Requirements Completeness Gate")
        section_start = MANAGED_MARKDOWN.index("## 機能要件")
        partial = MANAGED_MARKDOWN[:gate_start] + MANAGED_MARKDOWN[section_start:]

        imported = build_source(WORKSPACE, "requirements", partial)
        self.assertEqual(imported["validation"]["mode"], "legacy_import")

    def test_write_does_not_import_edited_markdown_preamble_into_json(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            managed = managed_source()
            serialized = serialize_source(managed)
            source_path.write_text(serialized, encoding="utf-8")
            display_path.write_text(
                render_artifact_markdown(managed).replace(
                    "# Requirements", "# Edited Requirements", 1
                ),
                encoding="utf-8",
            )
            initialize_repository(repo_root)

            with self.assertRaisesRegex(SourceError, "round-trip mismatch"):
                migrate(repo_root, True)

            self.assertEqual(source_path.read_text(encoding="utf-8"), serialized)

    def test_rejects_legacy_source_for_managed_markdown(self) -> None:
        for write in (False, True):
            with self.subTest(write=write):
                with tempfile.TemporaryDirectory() as directory:
                    repo_root = Path(directory).resolve()
                    display_path, source_path = artifact_paths(repo_root)
                    display_path.write_text(MANAGED_MARKDOWN, encoding="utf-8")
                    legacy = build_source(
                        WORKSPACE, "requirements", MANAGED_MARKDOWN
                    )
                    serialized = serialize_source(legacy)
                    source_path.write_text(serialized, encoding="utf-8")
                    initialize_repository(repo_root)

                    self.assertEqual(migrate(repo_root, write), 1)

                    self.assertEqual(
                        source_path.read_text(encoding="utf-8"), serialized
                    )

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

    def test_check_accepts_exact_legacy_inventory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            display_path.write_text(MARKDOWN, encoding="utf-8")
            legacy = build_source(WORKSPACE, "requirements", MARKDOWN)
            source_path.write_text(serialize_source(legacy), encoding="utf-8")
            initialize_repository(repo_root)

            self.assertEqual(migrate(repo_root, False), 1)

    def test_check_accepts_crlf_and_lf_as_the_same_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            display_path.write_bytes(b"# Requirements\r\n")
            legacy = build_source(WORKSPACE, "requirements", MARKDOWN)
            source_path.write_text(serialize_source(legacy), encoding="utf-8")
            initialize_repository(repo_root)

            self.assertEqual(migrate(repo_root, False), 1)

    def test_check_rejects_missing_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            display_path.write_text(MARKDOWN, encoding="utf-8")
            initialize_repository(repo_root)

            with self.assertRaisesRegex(SourceError, "source is missing"):
                migrate(repo_root, False)

            self.assertFalse(source_path.exists())

    def test_check_rejects_orphan_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            source_path.write_text(
                serialize_source(build_source(WORKSPACE, "requirements", MARKDOWN)),
                encoding="utf-8",
            )
            initialize_repository(repo_root)

            with self.assertRaisesRegex(SourceError, "display is missing"):
                migrate(repo_root, False)

            self.assertFalse(display_path.exists())

    def test_check_rejects_tracked_pair_deleted_from_worktree(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            display_path, source_path = artifact_paths(repo_root)
            display_path.write_text(MARKDOWN, encoding="utf-8")
            source_path.write_text(
                serialize_source(build_source(WORKSPACE, "requirements", MARKDOWN)),
                encoding="utf-8",
            )
            initialize_repository(repo_root)
            display_path.unlink()
            source_path.unlink()

            with self.assertRaisesRegex(SourceError, "display is missing"):
                migrate(repo_root, False)

    def test_write_rejects_symlinked_workspace_before_external_write(self) -> None:
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
                migrate(repo_root, True)

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
                migrate(repo_root, False)


if __name__ == "__main__":
    unittest.main()
