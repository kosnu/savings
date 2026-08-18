from __future__ import annotations

import ast
import copy
import subprocess
import tempfile
import unittest
from pathlib import Path

from artifact_source import (
    SourceError,
    load_source_bytes,
    serialize_source,
    validate_loaded_source,
)
from render_aidd_artifact import (
    check_all,
    check_or_write_markdown,
    render_artifact_markdown,
    render_goal_objective,
)


WORKSPACE = "1639-structured-data"
DIGEST = "0" * 64


def input_gate() -> dict[str, object]:
    return {
        "task_context": {
            "source": "issue_body",
            "issue": "owner/repo#1639",
            "url": "https://github.com/owner/repo/issues/1639",
            "updated_at": "2026-08-11T00:00:00Z",
            "body_sha256": DIGEST,
        },
        "direct_rules": [
            {
                "id": "ai-driven.workflow",
                "issue_evidence": "workflow",
                "match": {"field": "topics", "value": "workflow"},
                "reason": "fixture",
            }
        ],
        "depends_on": [],
    }


def completeness_gate() -> dict[str, object]:
    return {
        "issue_body_sha256": DIGEST,
        "workspace": WORKSPACE,
        "baseline": {"source": "none", "body_sha256": None},
        "requirements": [
            {"id": "FR-1", "status": "new", "issue_evidence": "scope"},
            {"id": "AC-1", "status": "new", "issue_evidence": "acceptance"},
        ],
        "sections": [
            {"id": "functional", "status": "new", "issue_evidence": "scope"},
            {"id": "acceptance", "status": "new", "issue_evidence": "acceptance"},
        ],
        "retired": [],
    }


def requirements_source() -> dict[str, object]:
    return {
        "schema_version": 2,
        "kind": "requirements",
        "workspace": WORKSPACE,
        "display": {"path": "requirements.md", "preamble": "# Requirements"},
        "validation": {
            "mode": "managed",
            "input_gate": input_gate(),
            "completeness_gate": completeness_gate(),
            "requirements": [
                {"id": "FR-1", "section_id": "functional", "text": "生成する。"},
                {"id": "AC-1", "section_id": "acceptance", "text": "確認する。"},
            ],
            "sections": [
                {
                    "id": "functional",
                    "heading": "機能要件",
                    "blocks": [
                        {
                            "id": "functional-intro",
                            "type": "markdown",
                            "markdown": "説明。",
                        },
                        {"id": "functional-requirements", "type": "requirements"},
                    ],
                },
                {
                    "id": "acceptance",
                    "heading": "受け入れ条件",
                    "blocks": [
                        {"id": "acceptance-requirements", "type": "requirements"}
                    ],
                },
            ],
        },
    }


def design_source() -> dict[str, object]:
    return {
        "schema_version": 2,
        "kind": "design",
        "workspace": WORKSPACE,
        "display": {"path": "design-doc.md", "preamble": "# Design"},
        "validation": {
            "mode": "managed",
            "sections": [
                {
                    "id": "evidence",
                    "heading": "Evidence",
                    "blocks": [
                        {
                            "id": "fr-1-design",
                            "type": "evidence",
                            "role": "design",
                            "owner_id": "FR-1",
                            "text": "設計する。",
                        },
                        {
                            "id": "fr-1-verify",
                            "type": "evidence",
                            "role": "verification",
                            "owner_id": "FR-1",
                            "text": "確認する。",
                        },
                    ],
                }
            ],
            "coverage_gate": {
                "requirements_sha256": DIGEST,
                "workspace": WORKSPACE,
                "requirement_ids": ["FR-1"],
                "baseline": {"source": "none", "body_sha256": None},
                "coverage": [
                    {
                        "id": "FR-1",
                        "design_block_id": "fr-1-design",
                        "verification_block_id": "fr-1-verify",
                    }
                ],
                "baseline_sections": [],
            },
        },
    }


def goal_source() -> dict[str, object]:
    return {
        "schema_version": 2,
        "kind": "requirements_goal",
        "workspace": WORKSPACE,
        "display": {
            "path": "goal.md",
            "title": "Requirements Goal",
            "goal": "全要件を定義する。",
            "context": {
                "body": ["Issue本文だけを正本とする。"],
                "constraints": [
                    {
                        "id": "task-context",
                        "text": "最新Issue本文だけをTask Context正本として扱う。",
                    },
                    {
                        "id": "phase-boundary",
                        "text": "Requirements Goal内では実装しない。",
                    },
                ],
                "stop": [
                    {
                        "id": "validation-failure",
                        "text": (
                            "workspaceまたはRequirements Gateの検証が"
                            "失敗した場合は停止する。"
                        ),
                    },
                    {
                        "id": "scope-ambiguity",
                        "text": (
                            "Issue本文から要求scopeを一意に決められない場合は"
                            "停止する。"
                        ),
                    },
                ],
            },
            "done": [
                {
                    "id": "complete-scope",
                    "text": (
                        "最新Issue全体を覆うRequirementsと全要求IDを定義する。"
                    ),
                },
                {
                    "id": "validated-artifact",
                    "text": (
                        "Requirements Gateと生成成果物の同期検証を成功させる。"
                    ),
                },
            ],
        },
        "validation": {
            "mode": "managed",
            "input_gate": input_gate(),
            "completeness_gate": completeness_gate(),
            "requirements": [
                {"id": "FR-1", "text": "生成する。"},
                {"id": "AC-1", "text": "確認する。"},
            ],
        },
    }


def design_goal_source() -> dict[str, object]:
    source = goal_source()
    source["kind"] = "design_goal"
    source["display"] = {
        "path": "goal.md",
        "title": "Design Goal",
        "goal": "全要求の設計を定義する。",
        "context": {
            "body": ["Requirements JSONをread-only入力にする。"],
            "constraints": [
                {
                    "id": "canonical-input",
                    "text": (
                        "検証済みのcanonical requirements.jsonを"
                        "read-only入力として扱う。"
                    ),
                },
                {
                    "id": "phase-boundary",
                    "text": "Design Goal内では実装しない。",
                },
            ],
            "stop": [
                {
                    "id": "validation-failure",
                    "text": (
                        "Requirements再検証またはDesign Coverage Gateが"
                        "失敗した場合は停止する。"
                    ),
                },
                {
                    "id": "scope-ambiguity",
                    "text": (
                        "要求ごとの設計・検証scopeを一意に決められない場合は"
                        "停止する。"
                    ),
                },
            ],
        },
        "done": [
            {
                "id": "complete-scope",
                "text": (
                    "全Requirements IDとbaseline sectionの"
                    "Design coverageを定義する。"
                ),
            },
            {
                "id": "validated-artifact",
                "text": (
                    "Design Coverage Gateと生成成果物の同期検証を成功させる。"
                ),
            },
        ],
    }
    source["validation"] = {
        "mode": "managed",
        "coverage_gate": {
            "requirements_sha256": DIGEST,
            "workspace": WORKSPACE,
            "requirement_ids": ["FR-1", "AC-1"],
            "baseline": {"source": "none", "body_sha256": None},
        },
        "scopes": [
            {
                "id": "FR-1",
                "design_scope": "設計する。",
                "verification_scope": "確認する。",
            },
            {
                "id": "AC-1",
                "design_scope": "受け入れを設計する。",
                "verification_scope": "受け入れを確認する。",
            },
        ],
        "baseline_scopes": [],
    }
    return source


class StructuredArtifactV2Test(unittest.TestCase):
    def test_requirements_render_from_typed_fields(self) -> None:
        rendered = render_artifact_markdown(requirements_source())
        self.assertIn("- FR-1: 生成する。", rendered)
        self.assertIn("## 機能要件", rendered)

    def test_requirements_reject_heading_that_matches_multiple_aliases(self) -> None:
        source = requirements_source()
        source["validation"]["sections"][0]["heading"] = "機能要件 / 非機能要件"
        with self.assertRaisesRegex(SourceError, "exactly one canonical section"):
            validate_loaded_source(source)

    def test_requirements_reject_heading_with_unapproved_suffix(self) -> None:
        source = requirements_source()
        source["validation"]["sections"][0]["heading"] = "機能要件と追加説明"
        with self.assertRaisesRegex(SourceError, "exactly one canonical section"):
            validate_loaded_source(source)

    def test_design_coverage_references_evidence_blocks(self) -> None:
        rendered = render_artifact_markdown(design_source())
        self.assertIn(
            "FR\\-1 design: 設計する。\nFR\\-1 verification: 確認する。",
            rendered,
        )

    def test_rule_reason_is_rendered_as_plain_text(self) -> None:
        source = requirements_source()
        source["validation"]["input_gate"]["direct_rules"][0]["reason"] = (
            "<!-- hidden -->"
        )
        rendered = render_artifact_markdown(source)
        self.assertIn(r"\<\!\-\- hidden \-\-\>", rendered)

    def test_markdown_block_is_display_only(self) -> None:
        source = requirements_source()
        source["validation"]["sections"][0]["blocks"][0]["markdown"] = (
            "~~~text\n## FR-999\n~~~\n<!-- AC-999 -->"
        )
        validate_loaded_source(source)
        self.assertIn("FR-999", render_artifact_markdown(source))

    def test_requirement_text_does_not_need_markdown_parsing(self) -> None:
        source = requirements_source()
        source["validation"]["requirements"][0]["text"] = "<tag> [FR-999][]"
        validate_loaded_source(source)
        rendered = render_artifact_markdown(source)
        self.assertIn(r"\<tag\> \[FR\-999\]\[\]", rendered)

    def test_rejects_multiline_requirement_text(self) -> None:
        source = requirements_source()
        source["validation"]["requirements"][0]["text"] = "visible\n## injected"
        with self.assertRaisesRegex(SourceError, "single line"):
            validate_loaded_source(source)

    def test_rejects_placeholder_evidence(self) -> None:
        for placeholder in ("TBD…", "ＴＢＤ", "T\u200bBD", "\u2060"):
            with self.subTest(placeholder=placeholder):
                source = design_source()
                source["validation"]["sections"][0]["blocks"][0]["text"] = (
                    placeholder
                )
                with self.assertRaisesRegex(SourceError, "substantive evidence"):
                    validate_loaded_source(source)

    def test_rejects_evidence_owned_by_another_requirement(self) -> None:
        source = design_source()
        source["validation"]["sections"][0]["blocks"][0]["owner_id"] = "FR-2"
        with self.assertRaisesRegex(SourceError, "owned by FR-1"):
            validate_loaded_source(source)

    def test_rejects_requirement_without_matching_block(self) -> None:
        source = requirements_source()
        source["validation"]["sections"][0]["blocks"].pop()
        with self.assertRaisesRegex(SourceError, "requirements block"):
            validate_loaded_source(source)

    def test_rejects_unknown_coverage_block_reference(self) -> None:
        source = design_source()
        source["validation"]["coverage_gate"]["coverage"][0][
            "design_block_id"
        ] = "missing"
        with self.assertRaisesRegex(SourceError, "evidence block"):
            validate_loaded_source(source)

    def test_rejects_duplicate_coverage_reference(self) -> None:
        source = design_source()
        source["validation"]["coverage_gate"]["coverage"][0][
            "verification_block_id"
        ] = "fr-1-design"
        with self.assertRaisesRegex(SourceError, "verification evidence"):
            validate_loaded_source(source)

    def test_accepts_preserved_baseline_without_evidence(self) -> None:
        source = design_source()
        source["validation"]["coverage_gate"]["baseline_sections"] = [
            {
                "section_id": "old-section",
                "heading": "旧設計",
                "content_sha256": DIGEST,
                "status": "preserved",
            }
        ]
        validate_loaded_source(source)

    def test_rejects_replaced_baseline_without_evidence(self) -> None:
        source = design_source()
        source["validation"]["coverage_gate"]["baseline_sections"] = [
            {
                "section_id": "old-section",
                "heading": "旧設計",
                "content_sha256": DIGEST,
                "status": "replaced",
            }
        ]
        with self.assertRaisesRegex(SourceError, "invalid keys"):
            validate_loaded_source(source)

    def test_rejects_unknown_keys(self) -> None:
        source = requirements_source()
        source["unexpected"] = True
        with self.assertRaisesRegex(SourceError, "invalid keys"):
            validate_loaded_source(source)

    def test_rejects_duplicate_json_keys(self) -> None:
        with self.assertRaisesRegex(SourceError, "duplicate key"):
            load_source_bytes(b'{"schema_version":2,"schema_version":2}')

    def test_rejects_non_json_constants(self) -> None:
        with self.assertRaisesRegex(SourceError, "non-JSON constant"):
            load_source_bytes(b'{"value":NaN}')

    def test_serialization_round_trip_is_canonical(self) -> None:
        source = requirements_source()
        loaded = load_source_bytes(serialize_source(source).encode("utf-8"))
        self.assertEqual(loaded, source)

    def test_goal_renders_from_typed_fields(self) -> None:
        rendered = render_goal_objective(goal_source())
        self.assertIn("## Context Packet", rendered)
        self.assertIn("- FR-1: 生成する。", rendered)
        self.assertIn("- Validated Scope: FR-1, AC-1", rendered)

    def test_design_goal_renders_scope_identity_from_typed_fields(self) -> None:
        rendered = render_goal_objective(design_goal_source())
        self.assertIn(r"- FR\-1 design scope: 設計する。", rendered)
        self.assertIn(r"- FR\-1 verification scope: 確認する。", rendered)

    def test_goal_requires_non_empty_context_contract(self) -> None:
        source = goal_source()
        source["display"]["context"]["stop"] = []
        with self.assertRaisesRegex(SourceError, "display.context.stop must be non-empty"):
            validate_loaded_source(source)

    def test_goal_rejects_multiline_plain_text_field(self) -> None:
        source = goal_source()
        source["display"]["context"]["stop"][0]["text"] = (
            "検証失敗なら停止する。\n## Done / Verification"
        )
        with self.assertRaisesRegex(SourceError, "single line"):
            validate_loaded_source(source)

    def test_goal_rejects_non_substantive_execution_contract(self) -> None:
        for kind, source_factory in (
            ("requirements", goal_source),
            ("design", design_goal_source),
        ):
            for field in ("goal", "body", "constraints", "stop", "done"):
                with self.subTest(kind=kind, field=field):
                    source = source_factory()
                    if field == "goal":
                        source["display"]["goal"] = "x"
                    elif field == "body":
                        source["display"]["context"]["body"][0] = "x"
                    elif field == "done":
                        source["display"]["done"][0]["text"] = "x"
                    else:
                        source["display"]["context"][field][0]["text"] = "x"
                    with self.assertRaisesRegex(SourceError, "substantive characters"):
                        validate_loaded_source(source)

    def test_goal_requires_phase_contract_ids_in_canonical_order(self) -> None:
        for kind, source_factory in (
            ("requirements", goal_source),
            ("design", design_goal_source),
        ):
            for field in ("constraints", "stop", "done"):
                with self.subTest(kind=kind, field=field, mutation="missing"):
                    source = source_factory()
                    entries = (
                        source["display"]["done"]
                        if field == "done"
                        else source["display"]["context"][field]
                    )
                    entries.pop(0)
                    with self.assertRaisesRegex(SourceError, "required IDs"):
                        validate_loaded_source(source)

                with self.subTest(kind=kind, field=field, mutation="order"):
                    source = source_factory()
                    entries = (
                        source["display"]["done"]
                        if field == "done"
                        else source["display"]["context"][field]
                    )
                    entries.reverse()
                    with self.assertRaisesRegex(SourceError, "canonical order"):
                        validate_loaded_source(source)

    def test_goal_required_contract_ids_require_canonical_text(self) -> None:
        for kind, source_factory in (
            ("requirements", goal_source),
            ("design", design_goal_source),
        ):
            for field in ("constraints", "stop", "done"):
                with self.subTest(kind=kind, field=field):
                    source = source_factory()
                    entries = (
                        source["display"]["done"]
                        if field == "done"
                        else source["display"]["context"][field]
                    )
                    entries[0]["text"] = (
                        "必須IDとは無関係な実質的説明をここに記載する。"
                    )
                    with self.assertRaisesRegex(SourceError, "canonical text"):
                        validate_loaded_source(source)

    def test_goal_accepts_additional_typed_contract_entry(self) -> None:
        source = goal_source()
        source["display"]["context"]["stop"].append(
            {
                "id": "custom-risk",
                "text": (
                    "repository固有の追加リスクを検出した場合は停止する。"
                ),
            }
        )
        rendered = render_goal_objective(source)

        self.assertIn("- Stop [custom-risk]:", rendered)
        self.assertIn("- [validated-artifact]", rendered)

    def test_generated_check_normalizes_line_endings(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory).resolve() / "artifact.md"
            path.write_bytes(b"line1\r\nline2\r\n")
            check_or_write_markdown("line1\nline2\n", path, True)

    def test_generated_check_rejects_string_difference(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory).resolve() / "artifact.md"
            path.write_text("different\n", encoding="utf-8")
            with self.assertRaisesRegex(SourceError, "stale"):
                check_or_write_markdown("expected\n", path, True)

    def test_check_all_rejects_goal_kind_at_canonical_artifact_path(self) -> None:
        for artifact_kind, source_filename, display_filename, source in (
            ("requirements", "requirements.json", "requirements.md", goal_source()),
            ("design", "design-doc.json", "design-doc.md", design_goal_source()),
        ):
            with self.subTest(artifact_kind=artifact_kind):
                with tempfile.TemporaryDirectory() as directory:
                    repo_root = Path(directory).resolve()
                    subprocess.run(
                        ["git", "-C", str(repo_root), "init", "-q"], check=True
                    )
                    subprocess.run(
                        [
                            "git",
                            "-C",
                            str(repo_root),
                            "config",
                            "user.name",
                            "AIDD Test",
                        ],
                        check=True,
                    )
                    subprocess.run(
                        [
                            "git",
                            "-C",
                            str(repo_root),
                            "config",
                            "user.email",
                            "aidd@example.com",
                        ],
                        check=True,
                    )
                    subprocess.run(
                        [
                            "git",
                            "-C",
                            str(repo_root),
                            "commit",
                            "--allow-empty",
                            "-qm",
                            "baseline",
                        ],
                        check=True,
                    )
                    workspace_root = (
                        repo_root
                        / "docs"
                        / "ai-driven-development"
                        / "workspaces"
                        / WORKSPACE
                    )
                    workspace_root.mkdir(parents=True)
                    (workspace_root / source_filename).write_text(
                        serialize_source(source), encoding="utf-8"
                    )
                    (workspace_root / display_filename).write_text(
                        render_goal_objective(source), encoding="utf-8"
                    )

                    with self.assertRaisesRegex(
                        SourceError,
                        f"{source_filename} must contain {artifact_kind} artifact source",
                    ):
                        check_all(repo_root)

    def test_check_all_rejects_missing_managed_source_from_git_head(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            subprocess.run(["git", "-C", str(repo_root), "init", "-q"], check=True)
            subprocess.run(
                [
                    "git",
                    "-C",
                    str(repo_root),
                    "config",
                    "user.name",
                    "AIDD Test",
                ],
                check=True,
            )
            subprocess.run(
                [
                    "git",
                    "-C",
                    str(repo_root),
                    "config",
                    "user.email",
                    "aidd@example.com",
                ],
                check=True,
            )
            workspace_root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            workspace_root.mkdir(parents=True)
            source_path = workspace_root / "requirements.json"
            display_path = workspace_root / "requirements.md"
            source = requirements_source()
            source_path.write_text(serialize_source(source), encoding="utf-8")
            display_path.write_text(
                render_artifact_markdown(source),
                encoding="utf-8",
            )
            subprocess.run(
                ["git", "-C", str(repo_root), "add", "."], check=True
            )
            subprocess.run(
                [
                    "git",
                    "-C",
                    str(repo_root),
                    "commit",
                    "-qm",
                    "managed artifact baseline",
                ],
                check=True,
            )
            source_path.unlink()

            with self.assertRaisesRegex(SourceError, "artifact source is missing"):
                check_all(repo_root)

    def test_managed_modules_do_not_import_markdown_parsers(self) -> None:
        scripts = Path(__file__).parent
        managed_modules = [
            "artifact_source.py",
            "render_aidd_artifact.py",
            "validate_requirements_goal.py",
            "validate_requirements_continuity.py",
            "validate_design_coverage.py",
        ]
        forbidden = {"requirement_ids", "structured_ids"}
        for filename in managed_modules:
            with self.subTest(filename=filename):
                tree = ast.parse((scripts / filename).read_text(encoding="utf-8"))
                imported = {
                    node.module
                    for node in ast.walk(tree)
                    if isinstance(node, ast.ImportFrom) and node.module is not None
                } | {
                    alias.name
                    for node in ast.walk(tree)
                    if isinstance(node, ast.Import)
                    for alias in node.names
                }
                self.assertTrue(forbidden.isdisjoint(imported))

if __name__ == "__main__":
    unittest.main()
