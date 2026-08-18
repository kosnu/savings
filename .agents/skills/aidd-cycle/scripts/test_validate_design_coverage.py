from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from artifact_source import (
    SourceError,
    serialize_source,
    structured_sha256,
    validate_loaded_source,
)
from validate_design_coverage import (
    ValidationError,
    design_sections,
    evidence_blocks,
    structured_sha256,
    validate,
    validate_baseline_sections,
    validate_baseline_scopes,
    validate_coverage,
    validate_scopes,
)


ISSUE = "owner/repo#1639"
ISSUE_URL = "https://github.com/owner/repo/issues/1639"
ISSUE_UPDATED_AT = "2026-08-11T00:00:00Z"
WORKSPACE = "1639-structured-data"
IDS = ["FR-1", "AC-1"]
ISSUE_BODY = "workflow\nJSON正本を検証する\n表示Markdownを検証入力にしない"
REQUIREMENTS_SECTIONS = [
    ("background", "背景"),
    ("users", "対象ユーザー"),
    ("stories", "ユーザーストーリー"),
    ("scope", "スコープ"),
    ("functional", "機能要件"),
    ("non-functional", "非機能要件"),
    ("acceptance", "受け入れ条件"),
    ("qa", "Q&A"),
    ("technical", "技術的考慮事項"),
]


def run_git(repo_root: Path, *arguments: str) -> None:
    subprocess.run(
        ["git", "-C", str(repo_root), *arguments],
        check=True,
        capture_output=True,
    )


def initialize_repo(repo_root: Path) -> None:
    run_git(repo_root, "init", "-q")
    run_git(repo_root, "config", "user.name", "AIDD Test")
    run_git(repo_root, "config", "user.email", "aidd@example.com")
    run_git(repo_root, "commit", "--allow-empty", "-qm", "baseline")


def requirements_source() -> dict[str, object]:
    issue_digest = hashlib.sha256(ISSUE_BODY.encode("utf-8")).hexdigest()
    sections: list[dict[str, object]] = []
    for section_id, heading in REQUIREMENTS_SECTIONS:
        if section_id in {"functional", "acceptance"}:
            blocks = [{"id": f"{section_id}-requirements", "type": "requirements"}]
        else:
            blocks = [
                {
                    "id": f"{section_id}-body",
                    "type": "markdown",
                    "markdown": f"{heading}の内容を定義する。",
                }
            ]
        sections.append({"id": section_id, "heading": heading, "blocks": blocks})
    return {
        "schema_version": 2,
        "kind": "requirements",
        "workspace": WORKSPACE,
        "display": {"path": "requirements.md", "preamble": "# Requirements"},
        "validation": {
            "mode": "managed",
            "input_gate": {
                "task_context": {
                    "source": "issue_body",
                    "issue": ISSUE,
                    "url": ISSUE_URL,
                    "updated_at": ISSUE_UPDATED_AT,
                    "body_sha256": issue_digest,
                },
                "direct_rules": [
                    {
                        "id": "ai-driven.workflow",
                        "issue_evidence": "workflow",
                        "match": {"field": "topics", "value": "workflow"},
                        "reason": "workflowを検証する",
                    }
                ],
                "depends_on": [],
            },
            "completeness_gate": {
                "issue_body_sha256": issue_digest,
                "workspace": WORKSPACE,
                "baseline": {"source": "none", "body_sha256": None},
                "requirements": [
                    {
                        "id": "FR-1",
                        "status": "new",
                        "issue_evidence": "JSON正本を検証する",
                    },
                    {
                        "id": "AC-1",
                        "status": "new",
                        "issue_evidence": "表示Markdownを検証入力にしない",
                    },
                ],
                "sections": [
                    {"id": section_id, "status": "new", "issue_evidence": None}
                    for section_id, _ in REQUIREMENTS_SECTIONS
                ],
                "retired": [],
            },
            "requirements": [
                {
                    "id": "FR-1",
                    "section_id": "functional",
                    "text": "JSON正本を検証する。",
                },
                {
                    "id": "AC-1",
                    "section_id": "acceptance",
                    "text": "表示Markdownを検証入力にしない。",
                },
            ],
            "sections": sections,
        },
    }


def goal_display() -> dict[str, object]:
    return {
        "path": "goal.md",
        "title": "Design Goal",
        "goal": "構造化Designを作成する。",
        "context": {
            "body": ["Requirements JSONを入力にする。"],
            "constraints": [
                {
                    "id": "canonical-input",
                    "text": "検証済みのcanonical requirements.jsonをread-only入力として扱う。",
                },
                {
                    "id": "phase-boundary",
                    "text": "Design Goal内では実装しない。",
                },
            ],
            "stop": [
                {
                    "id": "validation-failure",
                    "text": "Requirements再検証またはDesign Coverage Gateが失敗した場合は停止する。",
                },
                {
                    "id": "scope-ambiguity",
                    "text": "要求ごとの設計・検証scopeを一意に決められない場合は停止する。",
                },
            ],
        },
        "done": [
            {
                "id": "complete-scope",
                "text": "全Requirements IDとbaseline sectionのDesign coverageを定義する。",
            },
            {
                "id": "validated-artifact",
                "text": "Design Coverage Gateと生成成果物の同期検証を成功させる。",
            },
        ],
    }


def scopes() -> list[dict[str, str]]:
    return [
        {
            "id": requirement_id,
            "design_scope": f"{requirement_id}の設計境界を定義する。",
            "verification_scope": f"{requirement_id}の検証境界を定義する。",
        }
        for requirement_id in IDS
    ]


def coverage() -> list[dict[str, str]]:
    return [
        {
            "id": requirement_id,
            "design_block_id": f"{requirement_id.lower()}-design",
            "verification_block_id": f"{requirement_id.lower()}-verification",
        }
        for requirement_id in IDS
    ]


def typed_design_sections(
    *,
    include_baseline_evidence: int = 0,
    fake_markdown: str | None = None,
) -> list[dict[str, object]]:
    design_blocks: list[dict[str, str]] = [
        {
            "id": f"{requirement_id.lower()}-design",
            "type": "evidence",
            "role": "design",
            "owner_id": requirement_id,
            "text": f"{requirement_id}の設計根拠を保持する。",
        }
        for requirement_id in IDS
    ]
    design_blocks.extend(
        {
            "id": f"baseline-{index + 1}",
            "type": "evidence",
            "role": "baseline",
            "owner_id": ("旧設計", "旧検証")[index],
            "text": (
                f"{('旧設計', '旧検証')[index]}の"
                f"baseline section {index + 1}の置換根拠を保持する。"
            ),
        }
        for index in range(include_baseline_evidence)
    )
    if fake_markdown is not None:
        design_blocks.append(
            {"id": "display-only", "type": "markdown", "markdown": fake_markdown}
        )
    return [
        {"id": "design", "heading": "構造化設計", "blocks": design_blocks},
        {
            "id": "verification",
            "heading": "検証方針",
            "blocks": [
                {
                    "id": f"{requirement_id.lower()}-verification",
                    "type": "evidence",
                    "role": "verification",
                    "owner_id": requirement_id,
                    "text": f"{requirement_id}の検証根拠を保持する。",
                }
                for requirement_id in IDS
            ],
        },
    ]


def design_source(
    requirements_digest: str,
    *,
    baseline: dict[str, object] | None = None,
    baseline_sections: list[dict[str, str]] | None = None,
    coverage_entries: list[dict[str, str]] | None = None,
    sections: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    return {
        "schema_version": 2,
        "kind": "design",
        "workspace": WORKSPACE,
        "display": {"path": "design-doc.md", "preamble": "# Design"},
        "validation": {
            "mode": "managed",
            "sections": sections if sections is not None else typed_design_sections(),
            "coverage_gate": {
                "requirements_sha256": requirements_digest,
                "workspace": WORKSPACE,
                "requirement_ids": IDS,
                "baseline": baseline or {"source": "none", "body_sha256": None},
                "coverage": coverage_entries if coverage_entries is not None else coverage(),
                "baseline_sections": baseline_sections or [],
            },
        },
    }


def design_goal_source(
    requirements_digest: str,
    *,
    baseline: dict[str, object] | None = None,
    baseline_scopes: list[dict[str, str]] | None = None,
    scope_entries: list[dict[str, str]] | None = None,
) -> dict[str, object]:
    return {
        "schema_version": 2,
        "kind": "design_goal",
        "workspace": WORKSPACE,
        "display": goal_display(),
        "validation": {
            "mode": "managed",
            "coverage_gate": {
                "requirements_sha256": requirements_digest,
                "workspace": WORKSPACE,
                "requirement_ids": IDS,
                "baseline": baseline or {"source": "none", "body_sha256": None},
            },
            "scopes": scope_entries if scope_entries is not None else scopes(),
            "baseline_scopes": baseline_scopes or [],
        },
    }


class DesignCoverageGateTest(unittest.TestCase):
    def validate_source(
        self,
        *,
        kind: str,
        document: dict[str, object] | None = None,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            workspace_root = (
                repo_root / "docs" / "ai-driven-development" / "workspaces" / WORKSPACE
            )
            workspace_root.mkdir(parents=True)
            requirements_path = workspace_root / "requirements.json"
            requirements_path.write_text(
                serialize_source(requirements_source()), encoding="utf-8"
            )
            requirements_digest = hashlib.sha256(
                requirements_path.read_bytes()
            ).hexdigest()
            issue_body_path = repo_root / "issue-body.md"
            issue_body_path.write_text(ISSUE_BODY, encoding="utf-8")
            rule_map_path = repo_root / "docs" / "harness" / "rule-map.json"
            rule_map_path.parent.mkdir(parents=True)
            rule_map_path.write_text('{"rules": []}\n', encoding="utf-8")

            baseline: dict[str, object] = {"source": "none", "body_sha256": None}

            if document is None:
                if kind == "goal":
                    document = design_goal_source(
                        requirements_digest,
                        baseline=baseline,
                    )
                else:
                    document = design_source(
                        requirements_digest,
                        baseline=baseline,
                        baseline_sections=[],
                        sections=typed_design_sections(),
                    )
            document_path = (
                repo_root / "goal.json"
                if kind == "goal"
                else workspace_root / "design-doc.json"
            )
            document_path.write_text(
                json.dumps(document, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            with patch("validate_design_coverage.validate_requirements_input"), patch(
                "validate_design_coverage.validate_requirements_continuity"
            ):
                validate(
                    ISSUE,
                    ISSUE_URL,
                    ISSUE_UPDATED_AT,
                    issue_body_path,
                    rule_map_path,
                    requirements_path,
                    document_path,
                    kind,
                    repo_root,
                    WORKSPACE,
                )

    def test_accepts_goal_using_requirement_ids(self) -> None:
        self.validate_source(kind="goal")

    def test_rejects_multiline_goal_scope(self) -> None:
        source = design_goal_source("0" * 64)
        source["validation"]["scopes"][0]["design_scope"] = (
            "FR-1 design scope\n## injected"
        )
        with self.assertRaisesRegex(SourceError, "single line"):
            validate_loaded_source(source)

    def test_rejects_non_substantive_goal_scope(self) -> None:
        broken = scopes()
        broken[0]["design_scope"] = "x"
        with self.assertRaisesRegex(ValidationError, "not substantive"):
            validate_scopes(broken, IDS)

    def test_rejects_goal_scope_for_another_requirement_id(self) -> None:
        broken = scopes()
        broken[0]["design_scope"] = "AC-1の設計方針をそのまま採用する。"
        with self.assertRaisesRegex(ValidationError, "other than FR-1: AC-1"):
            validate_scopes(broken, IDS)

    def test_rejects_non_substantive_baseline_scope(self) -> None:
        with self.assertRaisesRegex(ValidationError, "not substantive"):
            validate_baseline_scopes(
                [
                    {
                        "section_id": "old-design",
                        "heading": "旧設計",
                        "review_scope": "x",
                    }
                ],
                [{"section_id": "old-design", "heading": "旧設計"}],
            )

    def test_allows_scope_for_heading_that_contains_another_heading(self) -> None:
        validate_baseline_scopes(
            [
                {
                    "section_id": "input",
                    "heading": "入力",
                    "review_scope": "入力 baseline scope: 現在Requirementsで再確認する。",
                },
                {
                    "section_id": "build-input",
                    "heading": "Build / Verifyへの入力",
                    "review_scope": (
                        "Build / Verifyへの入力 baseline scope: "
                        "現在Requirementsで再確認する。"
                    ),
                },
            ],
            [
                {"section_id": "input", "heading": "入力"},
                {"section_id": "build-input", "heading": "Build / Verifyへの入力"},
            ],
        )

    def test_rejects_baseline_scope_that_names_another_heading(self) -> None:
        with self.assertRaisesRegex(ValidationError, "only its target heading"):
            validate_baseline_scopes(
                [
                    {
                        "section_id": "input",
                        "heading": "入力",
                        "review_scope": (
                            "入力 baseline scope: 現在Requirementsで再確認する。"
                        ),
                    },
                    {
                        "section_id": "build-input",
                        "heading": "Build / Verifyへの入力",
                        "review_scope": (
                            "Build / Verifyへの入力 baseline scope: "
                            "入力も同時に再確認する。"
                        ),
                    },
                ],
                [
                    {"section_id": "input", "heading": "入力"},
                    {
                        "section_id": "build-input",
                        "heading": "Build / Verifyへの入力",
                    },
                ],
            )

    def test_rejects_short_heading_scope_that_only_names_nested_heading(self) -> None:
        with self.assertRaisesRegex(ValidationError, "only its target heading"):
            validate_baseline_scopes(
                [
                    {
                        "section_id": "input",
                        "heading": "入力",
                        "review_scope": (
                            "Build / Verifyへの入力 baseline scope: "
                            "現在Requirementsで再確認する。"
                        ),
                    },
                    {
                        "section_id": "build-input",
                        "heading": "Build / Verifyへの入力",
                        "review_scope": (
                            "Build / Verifyへの入力 baseline scope: "
                            "現在Requirementsで再確認する。"
                        ),
                    },
                ],
                [
                    {"section_id": "input", "heading": "入力"},
                    {
                        "section_id": "build-input",
                        "heading": "Build / Verifyへの入力",
                    },
                ],
            )

    def test_accepts_artifact_using_evidence_block_ids(self) -> None:
        self.validate_source(kind="artifact")

    def test_evidence_text_is_not_interpreted_as_markdown(self) -> None:
        blocks = {
            "design": {
                "id": "design",
                "type": "evidence",
                "role": "design",
                "owner_id": "FR-1",
                "text": "<!-- hidden evidence remains visible -->",
            },
            "verify": {
                "id": "verify",
                "type": "evidence",
                "role": "verification",
                "owner_id": "FR-1",
                "text": "`code evidence` [link remains visible](target)",
            },
        }
        validate_coverage(
            [
                {
                    "id": "FR-1",
                    "design_block_id": "design",
                    "verification_block_id": "verify",
                }
            ],
            ["FR-1"],
            blocks,
        )

    def test_rejects_placeholder_coverage_evidence(self) -> None:
        blocks = evidence_blocks(
            {"validation": {"sections": typed_design_sections()}}
        )
        blocks["fr-1-design"]["text"] = "（TBD）"
        with self.assertRaisesRegex(ValidationError, "unresolved"):
            validate_coverage(coverage(), IDS, blocks)

    def test_rejects_non_substantive_coverage_evidence(self) -> None:
        blocks = evidence_blocks(
            {"validation": {"sections": typed_design_sections()}}
        )
        blocks["fr-1-design"]["text"] = "x"
        with self.assertRaisesRegex(ValidationError, "not substantive"):
            validate_coverage(coverage(), IDS, blocks)

    def test_rejects_coverage_evidence_for_another_requirement_id(self) -> None:
        blocks = evidence_blocks(
            {"validation": {"sections": typed_design_sections()}}
        )
        blocks["fr-1-design"]["text"] = "AC-1の設計方針をそのまま採用する。"
        with self.assertRaisesRegex(ValidationError, "other than FR-1: AC-1"):
            validate_coverage(coverage(), IDS, blocks)

    def test_rejects_coverage_evidence_with_wrong_owner(self) -> None:
        blocks = evidence_blocks(
            {"validation": {"sections": typed_design_sections()}}
        )
        blocks["fr-1-design"]["owner_id"] = "FR-2"
        with self.assertRaisesRegex(ValidationError, "owner must be FR-1"):
            validate_coverage(coverage(), IDS, blocks)

    def test_markdown_block_cannot_supply_coverage(self) -> None:
        sections = typed_design_sections(fake_markdown="FR-999 fake coverage")
        blocks = evidence_blocks(
            {
                "validation": {"sections": sections},
            }
        )
        with self.assertRaisesRegex(ValidationError, "reference an evidence block"):
            validate_coverage(
                [
                    {
                        "id": "FR-1",
                        "design_block_id": "display-only",
                        "verification_block_id": "fr-1-verification",
                    }
                ],
                ["FR-1"],
                blocks,
            )

    def test_rejects_missing_evidence_block_reference(self) -> None:
        blocks = evidence_blocks(
            {"validation": {"sections": typed_design_sections()}}
        )
        broken = coverage()
        broken[0]["design_block_id"] = "missing"
        with self.assertRaisesRegex(ValidationError, "reference an evidence block"):
            validate_coverage(broken, IDS, blocks)

    def test_rejects_reused_evidence_block_reference(self) -> None:
        blocks = evidence_blocks(
            {"validation": {"sections": typed_design_sections()}}
        )
        broken = coverage()
        broken[1]["design_block_id"] = broken[0]["design_block_id"]
        with self.assertRaisesRegex(ValidationError, "owner must be AC-1"):
            validate_coverage(broken, IDS, blocks)

    def test_rejects_coverage_ids_that_do_not_match_requirements(self) -> None:
        blocks = evidence_blocks(
            {"validation": {"sections": typed_design_sections()}}
        )
        with self.assertRaisesRegex(ValidationError, "every Requirements ID"):
            validate_coverage(coverage()[:-1], IDS, blocks)

    def test_rejects_identical_design_and_verification_block_ids(self) -> None:
        blocks = evidence_blocks(
            {"validation": {"sections": typed_design_sections()}}
        )
        broken = coverage()
        broken[0]["verification_block_id"] = broken[0]["design_block_id"]
        with self.assertRaisesRegex(ValidationError, "verification evidence"):
            validate_coverage(broken, IDS, blocks)

    def test_rejects_identical_design_and_verification_evidence_text(self) -> None:
        blocks = evidence_blocks(
            {"validation": {"sections": typed_design_sections()}}
        )
        blocks["fr-1-verification"]["text"] = blocks["fr-1-design"]["text"]
        with self.assertRaisesRegex(ValidationError, "evidence text must differ"):
            validate_coverage(coverage(), IDS, blocks)

    def test_validates_baseline_transitions_using_digests_and_block_ids(self) -> None:
        blocks = {
            "baseline": {
                "id": "baseline",
                "type": "evidence",
                "role": "baseline",
                "owner_id": "旧設計",
                "text": "旧設計の置換根拠を十分に説明する。",
            }
        }
        validate_baseline_sections(
            [
                {
                    "section_id": None,
                    "heading": "旧設計",
                    "content_sha256": "old",
                    "status": "replaced",
                    "design_block_id": "baseline",
                }
            ],
            [{"section_id": None, "heading": "旧設計", "content_sha256": "old"}],
            [{"section_id": "new", "heading": "新設計", "content_sha256": "new"}],
            blocks,
        )

    def test_rejects_baseline_evidence_that_names_another_heading(self) -> None:
        blocks = {
            "baseline-a": {
                "id": "baseline-a",
                "type": "evidence",
                "role": "baseline",
                "owner_id": "old-a",
                "text": "旧設計Aと旧設計Bの判断をまとめて置換する。",
            },
            "baseline-b": {
                "id": "baseline-b",
                "type": "evidence",
                "role": "baseline",
                "owner_id": "old-b",
                "text": "旧設計Bの判断を個別に置換する。",
            },
        }
        with self.assertRaisesRegex(ValidationError, "only its target heading"):
            validate_baseline_sections(
                [
                    {
                        "section_id": "old-a",
                        "heading": "旧設計A",
                        "content_sha256": "old-a",
                        "status": "replaced",
                        "design_block_id": "baseline-a",
                    },
                    {
                        "section_id": "old-b",
                        "heading": "旧設計B",
                        "content_sha256": "old-b",
                        "status": "replaced",
                        "design_block_id": "baseline-b",
                    },
                ],
                [
                    {
                        "section_id": "old-a",
                        "heading": "旧設計A",
                        "content_sha256": "old-a",
                    },
                    {
                        "section_id": "old-b",
                        "heading": "旧設計B",
                        "content_sha256": "old-b",
                    },
                ],
                [],
                blocks,
            )

    def test_rejects_preserved_baseline_digest_missing_from_current_json(self) -> None:
        with self.assertRaisesRegex(ValidationError, "preserved baseline section changed"):
            validate_baseline_sections(
                [
                    {
                        "section_id": None,
                        "heading": "旧設計",
                        "content_sha256": "old",
                        "status": "preserved",
                    }
                ],
                [{"section_id": None, "heading": "旧設計", "content_sha256": "old"}],
                [{"section_id": "new", "heading": "新設計", "content_sha256": "new"}],
                {"baseline": {"id": "baseline", "type": "evidence", "role": "baseline", "owner_id": "旧設計", "text": "旧設計の変更根拠を十分に説明する。"}},
            )

    def test_rejects_replaced_baseline_digest_still_in_current_json(self) -> None:
        with self.assertRaisesRegex(ValidationError, "replaced baseline section is unchanged"):
            validate_baseline_sections(
                [
                    {
                        "section_id": None,
                        "heading": "旧設計",
                        "content_sha256": "same",
                        "status": "replaced",
                        "design_block_id": "baseline",
                    }
                ],
                [{"section_id": None, "heading": "旧設計", "content_sha256": "same"}],
                [{"section_id": "new", "heading": "旧設計", "content_sha256": "same"}],
                {"baseline": {"id": "baseline", "type": "evidence", "role": "baseline", "owner_id": "旧設計", "text": "旧設計の変更根拠を十分に説明する。"}},
            )

    def test_same_digest_under_different_section_id_is_not_preserved(self) -> None:
        with self.assertRaisesRegex(ValidationError, "preserved baseline section changed"):
            validate_baseline_sections(
                [
                    {
                        "section_id": "old-section",
                        "heading": "設計",
                        "content_sha256": "same",
                        "status": "preserved",
                    }
                ],
                [
                    {
                        "section_id": "old-section",
                        "heading": "設計",
                        "content_sha256": "same",
                    }
                ],
                [
                    {
                        "section_id": "new-section",
                        "heading": "設計",
                        "content_sha256": "same",
                    }
                ],
                {
                    "baseline": {
                        "id": "baseline",
                        "type": "evidence",
                        "role": "baseline",
                        "owner_id": "old-section",
                        "text": "設計を対象sectionとして変更根拠を十分に説明する。",
                    }
                },
            )

    def test_preserved_baseline_does_not_require_evidence(self) -> None:
        validate_baseline_sections(
            [
                {
                    "section_id": "section",
                    "heading": "設計",
                    "content_sha256": "same",
                    "status": "preserved",
                }
            ],
            [
                {
                    "section_id": "section",
                    "heading": "設計",
                    "content_sha256": "same",
                }
            ],
            [
                {
                    "section_id": "section",
                    "heading": "設計",
                    "content_sha256": "same",
                }
            ],
            {},
        )

    def test_v2_section_digest_uses_structured_json(self) -> None:
        section = typed_design_sections()[0]
        source = {
            "schema_version": 2,
            "validation": {"sections": [section]},
        }
        self.assertEqual(
            design_sections(source)[0]["content_sha256"], structured_sha256(section)
        )

    def test_validator_has_no_managed_markdown_parser_dependency(self) -> None:
        source = Path(__file__).with_name("validate_design_coverage.py").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("from structured_ids import", source)
        self.assertNotIn("mask_non_rendered_markdown", source)
        self.assertNotIn('["display"]', source)

    def test_rejects_noncanonical_requirements_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            requirements_path = repo_root / "requirements.json"
            requirements_path.write_text(
                serialize_source(requirements_source()), encoding="utf-8"
            )
            document = design_goal_source(
                hashlib.sha256(requirements_path.read_bytes()).hexdigest()
            )
            document_path = repo_root / "goal.json"
            document_path.write_text(json.dumps(document), encoding="utf-8")
            issue_body_path = repo_root / "issue-body.md"
            issue_body_path.write_text(ISSUE_BODY, encoding="utf-8")
            rule_map_path = repo_root / "docs" / "harness" / "rule-map.json"
            rule_map_path.parent.mkdir(parents=True)
            rule_map_path.write_text('{"rules": []}', encoding="utf-8")
            with self.assertRaisesRegex(ValidationError, "canonical repository path"):
                validate(
                    ISSUE,
                    ISSUE_URL,
                    ISSUE_UPDATED_AT,
                    issue_body_path,
                    rule_map_path,
                    requirements_path,
                    document_path,
                    "goal",
                    repo_root,
                    WORKSPACE,
                )


if __name__ == "__main__":
    unittest.main()
