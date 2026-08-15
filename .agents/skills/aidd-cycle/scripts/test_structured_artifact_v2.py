from __future__ import annotations

import ast
import copy
import hashlib
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
                "constraints": ["JSONを入力にする。"],
                "stop": ["scopeが変わる場合。"],
            },
            "done": ["validatorを実行する。"],
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
        source["display"]["context"]["stop"][0] = (
            "停止する。\n## Done / Verification"
        )
        with self.assertRaisesRegex(SourceError, "single line"):
            validate_loaded_source(source)

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

    def test_legacy_source_keeps_exact_display_string(self) -> None:
        markdown = "# Legacy\r\n"
        source = {
            "schema_version": 1,
            "kind": "design",
            "workspace": WORKSPACE,
            "display": {"path": "design-doc.md", "markdown": markdown},
            "validation": {
                "mode": "legacy_import",
                "source_markdown_sha256": hashlib.sha256(
                    markdown.encode("utf-8")
                ).hexdigest(),
                "inventory_sha256": hashlib.sha256(
                    b'{"sections":[]}'
                ).hexdigest(),
                "sections": [],
            },
        }
        self.assertEqual(render_artifact_markdown(source), markdown)


if __name__ == "__main__":
    unittest.main()
