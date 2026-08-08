from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from validate_design_coverage import (
    ValidationError,
    design_section_manifest,
    validate,
)


VALIDATOR_PATH = Path(__file__).with_name("validate_design_coverage.py")
ISSUE = "owner/repo#1563"
WORKSPACE = "1563-test-cycle"
REQUIREMENTS = """# Requirements

## 機能要件

### FR-1: 言語設定を保存する

### FR-2: 言語設定を復元する

## 非機能要件と制約

- NFR-1: 既存プロフィール更新を維持する。

## 受け入れ条件

- AC-1: 言語設定を再表示できる。
- AC-2: 保存失敗を成功扱いにしない。
"""
REQUIREMENT_IDS = ["FR-1", "FR-2", "NFR-1", "AC-1", "AC-2"]
BASELINE_DESIGN = """# Design Doc

## 実装方針

既存の保存境界を維持する。

## 検証方針

既存の統合テストを維持する。
"""


def run_git(repo_root: Path, *arguments: str) -> None:
    subprocess.run(
        ["git", "-C", str(repo_root), *arguments],
        check=True,
        capture_output=True,
    )


def initialize_repo(repo_root: Path, baseline_design: str | None) -> Path:
    run_git(repo_root, "init", "-q")
    run_git(repo_root, "config", "user.name", "AIDD Test")
    run_git(repo_root, "config", "user.email", "aidd@example.com")
    canonical_path = (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / WORKSPACE
        / "design-doc.md"
    )
    if baseline_design is not None:
        canonical_path.parent.mkdir(parents=True)
        canonical_path.write_text(baseline_design, encoding="utf-8")
        run_git(repo_root, "add", canonical_path.relative_to(repo_root).as_posix())
    run_git(repo_root, "commit", "--allow-empty", "-qm", "baseline")
    return canonical_path


def baseline_manifest(baseline_design: str | None) -> dict[str, object]:
    if baseline_design is None:
        return {"source": "none", "body_sha256": None}
    baseline_bytes = baseline_design.encode()
    return {
        "source": "git_head",
        "body_sha256": hashlib.sha256(baseline_bytes).hexdigest(),
    }


def goal_body(
    ids: list[str] = REQUIREMENT_IDS,
    baseline_design: str | None = None,
) -> str:
    lines = ["# Design Goal", "", "## Requirement Design Scope", ""]
    for requirement_id in ids:
        lines.extend(
            [
                f"- {requirement_id} design scope: 保存・復元境界を具体化する。",
                f"- {requirement_id} verification scope: 対応する挙動を個別に検証する。",
            ]
        )
    if baseline_design is not None:
        lines.extend(["", "## Baseline Design Scope", ""])
        for section in design_section_manifest(baseline_design):
            lines.append(
                f"- {section['heading']} baseline scope: 現在Requirementsへ再適合させる。"
            )
    return "\n".join(lines)


def design_body(ids: list[str] = REQUIREMENT_IDS, *, preserve_baseline: bool = False) -> str:
    lines = ["# Design Doc", ""]
    if preserve_baseline:
        lines.extend(
            [
                "## 実装方針",
                "",
                "既存の保存境界を維持する。",
                "",
                "## 要求別設計",
                "",
            ]
        )
    else:
        lines.extend(["## 実装方針", ""])
    for requirement_id in ids:
        lines.append(f"{requirement_id} design: 保存・復元境界を具体的に設計する。")
    if preserve_baseline:
        lines.extend(
            [
                "",
                "## Baseline Review",
                "",
                "実装方針として既存の保存境界を維持する。",
                "検証方針をFR-1 verificationの個別テストへ置換する。",
            ]
        )
    lines.extend(["", "## 検証方針", ""])
    for requirement_id in ids:
        lines.append(f"{requirement_id} verification: 対応する挙動を個別テストで検証する。")
    return "\n".join(lines)


def coverage(ids: list[str] = REQUIREMENT_IDS) -> list[dict[str, str]]:
    return [
        {
            "id": requirement_id,
            "design_evidence": (
                f"{requirement_id} design: 保存・復元境界を具体的に設計する。"
            ),
            "verification_evidence": (
                f"{requirement_id} verification: 対応する挙動を個別テストで検証する。"
            ),
        }
        for requirement_id in ids
    ]


def goal_manifest(
    *,
    requirements: str = REQUIREMENTS,
    requirement_ids: list[str] = REQUIREMENT_IDS,
    baseline_design: str | None = None,
) -> dict[str, object]:
    return {
        "requirements_sha256": hashlib.sha256(requirements.encode()).hexdigest(),
        "workspace": WORKSPACE,
        "requirement_ids": requirement_ids,
        "baseline": baseline_manifest(baseline_design),
    }


def artifact_manifest(
    *,
    requirements: str = REQUIREMENTS,
    requirement_ids: list[str] = REQUIREMENT_IDS,
    baseline_design: str | None = None,
    artifact_coverage: list[dict[str, str]] | None = None,
    baseline_sections: list[dict[str, str]] | None = None,
) -> dict[str, object]:
    return {
        "requirements_sha256": hashlib.sha256(requirements.encode()).hexdigest(),
        "workspace": WORKSPACE,
        "requirement_ids": requirement_ids,
        "baseline": baseline_manifest(baseline_design),
        "coverage": (
            artifact_coverage if artifact_coverage is not None else coverage(requirement_ids)
        ),
        "baseline_sections": baseline_sections or [],
    }


def document(value: dict[str, object], body: str) -> str:
    return (
        f"{body}\n\n## Design Coverage Gate\n\n"
        f"```json\n{json.dumps(value, ensure_ascii=False)}\n```\n"
    )


class DesignCoverageGateTest(unittest.TestCase):
    def validate_document(
        self,
        value: dict[str, object],
        *,
        kind: str,
        body: str,
        requirements: str = REQUIREMENTS,
        baseline_design: str | None = None,
        canonical: bool = True,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            canonical_path = initialize_repo(repo_root, baseline_design)
            requirements_path = repo_root / "requirements.md"
            requirements_path.write_text(requirements, encoding="utf-8")
            document_path = canonical_path if canonical else repo_root / "goal.md"
            document_path.parent.mkdir(parents=True, exist_ok=True)
            document_path.write_text(document(value, body), encoding="utf-8")
            validate(
                ISSUE,
                requirements_path,
                document_path,
                kind,
                repo_root,
                WORKSPACE,
            )

    def test_goal_accepts_per_requirement_plan(self) -> None:
        self.validate_document(
            goal_manifest(),
            kind="goal",
            body=goal_body(),
            canonical=False,
        )

    def test_goal_rejects_local_plan(self) -> None:
        with self.assertRaisesRegex(ValidationError, "must have exactly one scope line"):
            self.validate_document(
                goal_manifest(),
                kind="goal",
                body=goal_body(["AC-2"]),
                canonical=False,
            )

    def test_goal_rejects_scope_text_without_requirement_id(self) -> None:
        body = goal_body().replace(
            "- FR-1 design scope: 保存・復元境界を具体化する。",
            "- design scope: 保存・復元境界を具体化する。",
        )
        with self.assertRaisesRegex(ValidationError, "must have exactly one scope line"):
            self.validate_document(
                goal_manifest(),
                kind="goal",
                body=body,
                canonical=False,
            )

    def test_goal_accepts_git_baseline_section_scope(self) -> None:
        self.validate_document(
            goal_manifest(baseline_design=BASELINE_DESIGN),
            kind="goal",
            body=goal_body(baseline_design=BASELINE_DESIGN),
            baseline_design=BASELINE_DESIGN,
            canonical=False,
        )

    def test_artifact_accepts_per_requirement_coverage(self) -> None:
        self.validate_document(
            artifact_manifest(),
            kind="artifact",
            body=design_body(),
        )

    def test_artifact_rejects_grouped_coverage(self) -> None:
        grouped = [
            {
                "ids": REQUIREMENT_IDS,
                "design_evidence": "既存設計を維持する。",
                "verification_evidence": "既存テストを維持する。",
            }
        ]
        with self.assertRaisesRegex(ValidationError, "must contain only id"):
            self.validate_document(
                artifact_manifest(artifact_coverage=grouped),
                kind="artifact",
                body=design_body(),
            )

    def test_artifact_rejects_generic_evidence_without_id(self) -> None:
        entries = coverage()
        entries[0]["design_evidence"] = "保存・復元境界を具体的に設計する。"
        with self.assertRaisesRegex(ValidationError, "must name FR-1"):
            self.validate_document(
                artifact_manifest(artifact_coverage=entries),
                kind="artifact",
                body=f"{design_body()}\n保存・復元境界を具体的に設計する。",
            )

    def test_artifact_rejects_prefix_collision_as_requirement_evidence(self) -> None:
        entries = coverage()
        entries[0]["design_evidence"] = (
            "FR-10 design: 別要求の設計根拠を記載する。"
        )
        with self.assertRaisesRegex(ValidationError, "must name FR-1"):
            self.validate_document(
                artifact_manifest(artifact_coverage=entries),
                kind="artifact",
                body=f"{design_body()}\n{entries[0]['design_evidence']}",
            )

    def test_artifact_rejects_missing_requirement_entry(self) -> None:
        with self.assertRaisesRegex(ValidationError, "exactly one entry"):
            self.validate_document(
                artifact_manifest(artifact_coverage=coverage()[:-1]),
                kind="artifact",
                body=design_body(),
            )

    def test_artifact_classifies_every_git_baseline_section(self) -> None:
        sections = design_section_manifest(BASELINE_DESIGN)
        transitions = [
            {
                "heading": sections[0]["heading"],
                "content_sha256": sections[0]["content_sha256"],
                "status": "preserved",
                "design_evidence": "実装方針として既存の保存境界を維持する。",
            },
            {
                "heading": sections[1]["heading"],
                "content_sha256": sections[1]["content_sha256"],
                "status": "replaced",
                "design_evidence": "検証方針をFR-1 verificationの個別テストへ置換する。",
            },
        ]
        self.validate_document(
            artifact_manifest(
                baseline_design=BASELINE_DESIGN,
                baseline_sections=transitions,
            ),
            kind="artifact",
            body=design_body(preserve_baseline=True),
            baseline_design=BASELINE_DESIGN,
        )

    def test_artifact_rejects_unclassified_git_baseline_section(self) -> None:
        sections = design_section_manifest(BASELINE_DESIGN)
        transitions = [
            {
                "heading": sections[0]["heading"],
                "content_sha256": sections[0]["content_sha256"],
                "status": "preserved",
                "design_evidence": "実装方針として既存の保存境界を維持する。",
            }
        ]
        with self.assertRaisesRegex(ValidationError, "classify every Git HEAD section"):
            self.validate_document(
                artifact_manifest(
                    baseline_design=BASELINE_DESIGN,
                    baseline_sections=transitions,
                ),
                kind="artifact",
                body=design_body(preserve_baseline=True),
                baseline_design=BASELINE_DESIGN,
            )

    def test_artifact_rejects_shared_baseline_section_evidence(self) -> None:
        sections = design_section_manifest(BASELINE_DESIGN)
        shared_evidence = "実装方針と検証方針を新しい要求別設計へ置換する。"
        transitions = [
            {
                "heading": section["heading"],
                "content_sha256": section["content_sha256"],
                "status": "replaced",
                "design_evidence": shared_evidence,
            }
            for section in sections
        ]
        with self.assertRaisesRegex(ValidationError, "design_evidence must be unique"):
            self.validate_document(
                artifact_manifest(
                    baseline_design=BASELINE_DESIGN,
                    baseline_sections=transitions,
                ),
                kind="artifact",
                body=f"{design_body()}\n{shared_evidence}",
                baseline_design=BASELINE_DESIGN,
            )

    def test_artifact_rejects_noncanonical_path(self) -> None:
        with self.assertRaisesRegex(ValidationError, "canonical workspace path"):
            self.validate_document(
                artifact_manifest(),
                kind="artifact",
                body=design_body(),
                canonical=False,
            )

    def test_cli_accepts_complete_design_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            canonical_path = initialize_repo(repo_root, None)
            requirements_path = repo_root / "requirements.md"
            requirements_path.write_text(REQUIREMENTS, encoding="utf-8")
            canonical_path.parent.mkdir(parents=True, exist_ok=True)
            canonical_path.write_text(
                document(artifact_manifest(), design_body()),
                encoding="utf-8",
            )
            result = subprocess.run(
                [
                    sys.executable,
                    str(VALIDATOR_PATH),
                    "--issue",
                    ISSUE,
                    "--requirements",
                    str(requirements_path),
                    "--document",
                    str(canonical_path),
                    "--kind",
                    "artifact",
                    "--repo-root",
                    str(repo_root),
                    "--workspace",
                    WORKSPACE,
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
