from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

from artifact_source import serialize_source
from structured_ids import REQUIRED_REQUIREMENTS_SECTIONS
from validate_design_coverage import (
    ValidationError,
    content_sha256,
    validate,
    validate_baseline_scopes,
    validate_baseline_sections,
)


ISSUE = "owner/repo#1639"
ISSUE_URL = "https://github.com/owner/repo/issues/1639"
ISSUE_UPDATED_AT = "2026-08-11T00:00:00Z"
WORKSPACE = "1639-structured-data"
REQUIREMENTS = [
    {"id": "FR-1", "content": "- FR-1: JSON正本を検証する。"},
    {"id": "AC-1", "content": "- AC-1: 表示Markdownを検証入力にしない。"},
]
IDS = [entry["id"] for entry in REQUIREMENTS]
SECTION_EVIDENCE = {
    "background": "背景情報の根拠を定義する",
    "users": "対象利用者の根拠を定義する",
    "stories": "利用場面の根拠を定義する",
    "scope": "対象範囲の根拠を定義する",
    "functional": "機能一覧の根拠を定義する",
    "non_functional": "品質制約の根拠を定義する",
    "acceptance": "完了条件の根拠を定義する",
    "qa": "確認事項の根拠を定義する",
    "technical": "技術考慮の根拠を定義する",
}
ISSUE_BODY = "\n".join(
    [
        "workflow",
        "JSON正本を検証する",
        "表示Markdownを検証入力にしない",
        *SECTION_EVIDENCE.values(),
    ]
)


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


def envelope(kind: str, validation: dict[str, object], markdown: str = "# display\n") -> dict[str, object]:
    return {
        "schema_version": 1,
        "kind": kind,
        "workspace": WORKSPACE,
        "display": {
            "path": "goal.md" if kind == "design_goal" else (
                "requirements.md" if kind == "requirements" else "design-doc.md"
            ),
            "markdown": markdown,
        },
        "validation": {"mode": "managed", **validation},
    }


def requirements_sections() -> list[dict[str, str]]:
    values: list[dict[str, str]] = []
    for section_id, headings in REQUIRED_REQUIREMENTS_SECTIONS.items():
        content_lines = [f"## {headings[0]}", SECTION_EVIDENCE[section_id]]
        if section_id == "functional":
            content_lines.append(REQUIREMENTS[0]["content"])
        if section_id == "acceptance":
            content_lines.append(REQUIREMENTS[1]["content"])
        values.append(
            {
                "id": section_id,
                "heading": headings[0],
                "content": "\n".join(content_lines),
            }
        )
    return values


def requirements_validation() -> dict[str, object]:
    body_bytes = ISSUE_BODY.encode("utf-8")
    return {
        "input_gate": {
            "task_context": {
                "source": "issue_body",
                "issue": ISSUE,
                "url": ISSUE_URL,
                "updated_at": ISSUE_UPDATED_AT,
                "body_sha256": hashlib.sha256(body_bytes).hexdigest(),
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
            "issue_body_sha256": hashlib.sha256(body_bytes).hexdigest(),
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
                {
                    "id": section_id,
                    "status": "new",
                    "issue_evidence": SECTION_EVIDENCE[section_id],
                }
                for section_id in REQUIRED_REQUIREMENTS_SECTIONS
            ],
            "retired": [],
        },
        "requirements": REQUIREMENTS,
        "sections": requirements_sections(),
    }


def write_requirements_gate_inputs(
    repo_root: Path,
    requirements_path: Path,
    missing_gate: str | None = None,
) -> tuple[Path, Path]:
    issue_body_path = repo_root / "issue-body.md"
    issue_body_path.write_text(ISSUE_BODY, encoding="utf-8")
    rule_map_path = repo_root / "docs" / "harness" / "rule-map.json"
    rule_map_path.parent.mkdir(parents=True, exist_ok=True)
    rule_map_path.write_text(
        json.dumps(
            {
                "rules": [
                    {
                        "id": "ai-driven.workflow",
                        "applies_to": {
                            "paths": [],
                            "domains": [],
                            "activities": [],
                            "topics": ["workflow"],
                        },
                        "depends_on": [],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    validation = requirements_validation()
    if missing_gate is not None:
        validation.pop(missing_gate)
    requirements_path.write_text(
        serialize_source(envelope("requirements", validation)),
        encoding="utf-8",
    )
    return issue_body_path, rule_map_path


def scopes() -> list[dict[str, str]]:
    return [
        {
            "id": requirement_id,
            "design_scope": f"{requirement_id} の構造化設計境界を定義する。",
            "verification_scope": f"{requirement_id} の構造化検証を個別に確認する。",
        }
        for requirement_id in IDS
    ]


def baseline_scopes() -> list[dict[str, str]]:
    return [
        {
            "heading": entry["heading"],
            "review_scope": (
                f"{entry['heading']} baseline scope: 現在Requirementsへ再適合させる。"
            ),
        }
        for entry in sections()
    ]


def coverage() -> list[dict[str, str]]:
    return [
        {
            "id": requirement_id,
            "design_evidence": f"{requirement_id} の構造化設計を実装する。",
            "verification_evidence": f"{requirement_id} の構造化検証を実行する。",
        }
        for requirement_id in IDS
    ]


def sections() -> list[dict[str, str]]:
    evidence = coverage()
    return [
        {
            "heading": "構造化設計",
            "content": "\n".join(
                entry["design_evidence"] for entry in evidence
            ),
        },
        {
            "heading": "検証方針",
            "content": "\n".join(
                entry["verification_evidence"] for entry in evidence
            ),
        },
    ]


class DesignCoverageGateTest(unittest.TestCase):
    def validate_source(
        self,
        *,
        kind: str,
        goal_scopes: list[dict[str, str]] | None = None,
        goal_baseline_scopes: list[dict[str, str]] | None = None,
        artifact_coverage: list[dict[str, str]] | None = None,
        artifact_sections: list[dict[str, str]] | None = None,
        markdown: str = "# display\n",
        canonical_requirements: bool = True,
        with_design_baseline: bool = False,
        missing_requirements_gate: str | None = None,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            initialize_repo(repo_root)
            workspace_root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            workspace_root.mkdir(parents=True)
            requirements_path = (
                workspace_root / "requirements.json"
                if canonical_requirements
                else repo_root / "requirements.json"
            )
            issue_body_path, rule_map_path = write_requirements_gate_inputs(
                repo_root,
                requirements_path,
                missing_requirements_gate,
            )
            requirements_hash = hashlib.sha256(requirements_path.read_bytes()).hexdigest()
            if with_design_baseline:
                baseline_path = workspace_root / "design.json"
                baseline_path.write_text(
                    serialize_source(envelope("design", {"sections": sections()})),
                    encoding="utf-8",
                )
                run_git(repo_root, "add", str(baseline_path.relative_to(repo_root)))
                run_git(repo_root, "commit", "-qm", "design baseline")
                baseline_bytes = baseline_path.read_bytes()
                baseline = {
                    "source": "git_head",
                    "body_sha256": hashlib.sha256(baseline_bytes).hexdigest(),
                }
            else:
                baseline = {"source": "none", "body_sha256": None}
            common_gate = {
                "requirements_sha256": requirements_hash,
                "workspace": WORKSPACE,
                "requirement_ids": IDS,
                "baseline": baseline,
            }
            if kind == "goal":
                document_path = repo_root / "goal.json"
                value = envelope(
                    "design_goal",
                    {
                        "coverage_gate": common_gate,
                        "scopes": goal_scopes or scopes(),
                        "baseline_scopes": (
                            goal_baseline_scopes
                            if goal_baseline_scopes is not None
                            else []
                        ),
                    },
                    markdown,
                )
            else:
                document_path = workspace_root / "design.json"
                value = envelope(
                    "design",
                    {
                        "sections": (
                            artifact_sections
                            if artifact_sections is not None
                            else sections()
                        ),
                        "coverage_gate": {
                            **common_gate,
                            "coverage": (
                                artifact_coverage
                                if artifact_coverage is not None
                                else coverage()
                            ),
                            "baseline_sections": [],
                        },
                    },
                    markdown,
                )
            document_path.write_text(serialize_source(value), encoding="utf-8")
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

    def test_accepts_goal_json(self) -> None:
        self.validate_source(kind="goal")

    def test_accepts_goal_with_every_git_head_design_section(self) -> None:
        self.validate_source(
            kind="goal",
            goal_baseline_scopes=baseline_scopes(),
            with_design_baseline=True,
        )

    def test_rejects_goal_without_git_head_design_sections(self) -> None:
        with self.assertRaisesRegex(ValidationError, "every Git HEAD section"):
            self.validate_source(kind="goal", with_design_baseline=True)

    def test_allows_scope_for_heading_that_contains_another_heading(self) -> None:
        validate_baseline_scopes(
            [
                {
                    "heading": "入力",
                    "review_scope": "入力 baseline scope: 現在Requirementsで再確認する。",
                },
                {
                    "heading": "Build / Verifyへの入力",
                    "review_scope": (
                        "Build / Verifyへの入力 baseline scope: "
                        "現在Requirementsで再確認する。"
                    ),
                },
            ],
            [
                {"heading": "入力", "content_sha256": "first"},
                {
                    "heading": "Build / Verifyへの入力",
                    "content_sha256": "second",
                },
            ],
        )

    def test_rejects_nested_scope_that_also_names_shorter_heading(self) -> None:
        with self.assertRaisesRegex(ValidationError, "only its target heading"):
            validate_baseline_scopes(
                [
                    {
                        "heading": "入力",
                        "review_scope": (
                            "入力 baseline scope: 現在Requirementsで再確認する。"
                        ),
                    },
                    {
                        "heading": "Build / Verifyへの入力",
                        "review_scope": (
                            "Build / Verifyへの入力 baseline scope: "
                            "入力も同時に再確認する。"
                        ),
                    },
                ],
                [
                    {"heading": "入力", "content_sha256": "first"},
                    {
                        "heading": "Build / Verifyへの入力",
                        "content_sha256": "second",
                    },
                ],
            )

    def test_accepts_artifact_json(self) -> None:
        self.validate_source(kind="artifact")

    def test_display_markdown_cannot_supply_coverage(self) -> None:
        self.validate_source(
            kind="artifact",
            markdown="```json\nFR-999 fake coverage\n```\n",
        )

    def test_rejects_requirements_without_input_gate(self) -> None:
        with self.assertRaisesRegex(
            ValidationError, "Requirements artifact gate revalidation failed"
        ):
            self.validate_source(
                kind="goal",
                missing_requirements_gate="input_gate",
            )

    def test_rejects_requirements_without_completeness_gate(self) -> None:
        with self.assertRaisesRegex(
            ValidationError, "Requirements artifact gate revalidation failed"
        ):
            self.validate_source(
                kind="goal",
                missing_requirements_gate="completeness_gate",
            )

    def test_rejects_scope_that_groups_requirement_ids(self) -> None:
        grouped = deepcopy(scopes())
        grouped[0]["design_scope"] += " AC-1も同時に扱う。"
        with self.assertRaisesRegex(ValidationError, "must name only FR-1"):
            self.validate_source(kind="goal", goal_scopes=grouped)

    def test_rejects_identical_design_and_verification_scopes(self) -> None:
        identical = deepcopy(scopes())
        identical[0]["verification_scope"] = (
            f"{identical[0]['id']}   の構造化設計境界を定義する。"
        )
        with self.assertRaisesRegex(ValidationError, "scopes must differ"):
            self.validate_source(kind="goal", goal_scopes=identical)

    def test_rejects_identical_design_and_verification_evidence(self) -> None:
        identical = coverage()
        identical[0]["verification_evidence"] = (
            f"{identical[0]['id']}   の構造化設計を実装する。"
        )
        with self.assertRaisesRegex(ValidationError, "evidence must differ"):
            self.validate_source(kind="artifact", artifact_coverage=identical)

    def test_rejects_coverage_evidence_missing_from_design_sections(self) -> None:
        missing = coverage()
        missing[0]["design_evidence"] = (
            "FR-1 の構造化設計を別の根拠として実装する。"
        )

        with self.assertRaisesRegex(
            ValidationError,
            "design_evidence must be exactly one Design section line",
        ):
            self.validate_source(kind="artifact", artifact_coverage=missing)

    def test_rejects_coverage_evidence_repeated_in_design_sections(self) -> None:
        repeated_sections = sections()
        repeated_sections[1]["content"] += (
            f"\n{coverage()[0]['design_evidence']}"
        )

        with self.assertRaisesRegex(
            ValidationError,
            "design_evidence must be exactly one Design section line",
        ):
            self.validate_source(
                kind="artifact",
                artifact_sections=repeated_sections,
            )

    def test_rejects_heading_only_baseline_evidence(self) -> None:
        for evidence in (
            "構造化設計",
            "構造化設計 構造化設計 構造化設計",
            "構造化設計.........***",
        ):
            with self.subTest(evidence=evidence):
                with self.assertRaisesRegex(ValidationError, "not substantive"):
                    validate_baseline_sections(
                        [
                            {
                                "heading": "構造化設計",
                                "content_sha256": "baseline-hash",
                                "status": "preserved",
                                "design_evidence": evidence,
                            }
                        ],
                        [
                            {
                                "heading": "構造化設計",
                                "content_sha256": "baseline-hash",
                            }
                        ],
                        [
                            {
                                "heading": "構造化設計",
                                "content_sha256": "baseline-hash",
                            }
                        ],
                    )

    def test_rejects_reused_normalized_baseline_evidence(self) -> None:
        shared_evidence = (
            "Build / Verifyへの入力を現在Requirementsへ適合させたまま維持する。"
        )
        with self.assertRaisesRegex(ValidationError, "evidence must be unique"):
            validate_baseline_sections(
                [
                    {
                        "heading": "入力",
                        "content_sha256": "first",
                        "status": "preserved",
                        "design_evidence": shared_evidence,
                    },
                    {
                        "heading": "Build / Verifyへの入力",
                        "content_sha256": "second",
                        "status": "preserved",
                        "design_evidence": f"  {shared_evidence}  ",
                    },
                ],
                [
                    {"heading": "入力", "content_sha256": "first"},
                    {
                        "heading": "Build / Verifyへの入力",
                        "content_sha256": "second",
                    },
                ],
                [
                    {"heading": "入力", "content_sha256": "first"},
                    {
                        "heading": "Build / Verifyへの入力",
                        "content_sha256": "second",
                    },
                ],
            )

    def test_rejects_noncanonical_requirements_source(self) -> None:
        with self.assertRaisesRegex(ValidationError, "canonical repository path"):
            self.validate_source(kind="goal", canonical_requirements=False)

    def test_accepts_preserved_git_head_design_sections(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            run_git(repo_root, "init", "-q")
            run_git(repo_root, "config", "user.name", "AIDD Test")
            run_git(repo_root, "config", "user.email", "aidd@example.com")
            workspace_root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            workspace_root.mkdir(parents=True)
            requirements_path = workspace_root / "requirements.json"
            issue_body_path, rule_map_path = write_requirements_gate_inputs(
                repo_root,
                requirements_path,
            )
            design_path = workspace_root / "design.json"
            baseline_source = envelope("design", {"sections": sections()})
            design_path.write_text(serialize_source(baseline_source), encoding="utf-8")
            run_git(repo_root, "add", str(design_path.relative_to(repo_root)))
            run_git(repo_root, "commit", "-qm", "baseline")
            baseline_bytes = design_path.read_bytes()
            gate = {
                "requirements_sha256": hashlib.sha256(
                    requirements_path.read_bytes()
                ).hexdigest(),
                "workspace": WORKSPACE,
                "requirement_ids": IDS,
                "baseline": {
                    "source": "git_head",
                    "body_sha256": hashlib.sha256(baseline_bytes).hexdigest(),
                },
                "coverage": coverage(),
                "baseline_sections": [
                    {
                        "heading": entry["heading"],
                        "content_sha256": content_sha256(entry["content"]),
                        "status": "preserved",
                        "design_evidence": (
                            f"{entry['heading']}を現在Requirementsへ"
                            "適合させたまま維持する。"
                        ),
                    }
                    for entry in sections()
                ],
            }
            design_path.write_text(
                serialize_source(
                    envelope(
                        "design",
                        {"sections": sections(), "coverage_gate": gate},
                    )
                ),
                encoding="utf-8",
            )
            validate(
                ISSUE,
                ISSUE_URL,
                ISSUE_UPDATED_AT,
                issue_body_path,
                rule_map_path,
                requirements_path,
                design_path,
                "artifact",
                repo_root,
                WORKSPACE,
            )


if __name__ == "__main__":
    unittest.main()
