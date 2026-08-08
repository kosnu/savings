from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from validate_requirements_continuity import (
    ValidationError,
    validate,
)


VALIDATOR_PATH = Path(__file__).with_name("validate_requirements_continuity.py")
ISSUE = "owner/repo#1563"
WORKSPACE = "1563-test-cycle"
ISSUE_BODY = """# 言語設定

言語設定を保存し、既存のプロフィール更新を維持する。
Storybookで状態を確認できるようにする。
"""
BASELINE = """# Requirements

## 背景と課題

言語設定が永続化されていない。

## 対象ユーザーと利用シーン

ログイン済みユーザーが設定画面を利用する。

## ユーザーストーリー

ユーザーとして言語設定を維持したい。

## スコープ

言語設定の保存と復元を対象にする。

## 機能要件

### FR-1: 言語設定を保存する

DB正本へ選択値を保存する。

### FR-2: 言語設定を復元する

保存済みの選択値を初期表示する。

## 非機能要件と制約

- NFR-1: 既存プロフィール更新を維持する。

## 受け入れ条件

- AC-1: 言語設定を再表示できる。
  - 保存済みの選択値と一致する。
- AC-2: 保存失敗を成功扱いにしない。

## Q&Aログ

未決事項なし。

## 技術的考慮事項

DB、API、型、RLSを同期する。
"""
CURRENT = BASELINE.replace(
    "- AC-2: 保存失敗を成功扱いにしない。",
    "- AC-2: 保存失敗を成功扱いにしない。\n"
    "- AC-3: Storybookで状態を確認できるようにする。",
)
BASELINE_IDS = ["FR-1", "FR-2", "NFR-1", "AC-1", "AC-2"]
SECTION_IDS = [
    "background",
    "users",
    "stories",
    "scope",
    "functional",
    "non_functional",
    "acceptance",
    "qa",
    "technical",
]
FIRST_CYCLE_REQUIREMENT_EVIDENCE = {
    "FR-1": "DB正本へ選択値を保存する。",
    "FR-2": "保存済みの選択値を初期表示する。",
    "NFR-1": "既存プロフィール更新を維持する。",
    "AC-1": "保存済みの選択値と一致する。",
    "AC-2": "保存失敗を成功扱いにしない。",
    "AC-3": "Storybookで状態を確認できるようにする。",
}
FIRST_CYCLE_SECTION_EVIDENCE = {
    "background": "言語設定が永続化されていない。",
    "users": "ログイン済みユーザーが設定画面を利用する。",
    "stories": "ユーザーとして言語設定を維持したい。",
    "scope": "言語設定の保存と復元を対象にする。",
    "functional": "DB正本へ選択値を保存する。",
    "non_functional": "既存プロフィール更新を維持する。",
    "acceptance": "Storybookで状態を確認できるようにする。",
    "qa": "未決事項なし。",
    "technical": "DB、API、型、RLSを同期する。",
}


def run_git(repo_root: Path, *arguments: str) -> None:
    subprocess.run(
        ["git", "-C", str(repo_root), *arguments],
        check=True,
        capture_output=True,
    )


def initialize_repo(repo_root: Path, baseline: str | None) -> Path:
    run_git(repo_root, "init", "-q")
    run_git(repo_root, "config", "user.name", "AIDD Test")
    run_git(repo_root, "config", "user.email", "aidd@example.com")
    canonical_path = (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / WORKSPACE
        / "requirements.md"
    )
    if baseline is not None:
        canonical_path.parent.mkdir(parents=True)
        canonical_path.write_text(baseline, encoding="utf-8")
        run_git(repo_root, "add", canonical_path.relative_to(repo_root).as_posix())
    run_git(repo_root, "commit", "--allow-empty", "-qm", "baseline")
    return canonical_path


def baseline_manifest(baseline: str | None) -> dict[str, object]:
    if baseline is None:
        return {"source": "none", "body_sha256": None}
    baseline_bytes = baseline.encode()
    return {
        "source": "git_head",
        "body_sha256": hashlib.sha256(baseline_bytes).hexdigest(),
    }


def unchanged_entries(ids: list[str] = BASELINE_IDS) -> list[dict[str, object]]:
    return [
        {"id": requirement_id, "status": "unchanged", "issue_evidence": None}
        for requirement_id in ids
    ]


def section_entries(
    *,
    baseline: bool = True,
    changed: dict[str, str] | None = None,
) -> list[dict[str, object]]:
    changed = changed or {}
    entries: list[dict[str, object]] = []
    for section_id in SECTION_IDS:
        if not baseline:
            status = "new"
            evidence = FIRST_CYCLE_SECTION_EVIDENCE[section_id]
        elif section_id in changed:
            status = "changed"
            evidence = changed[section_id]
        elif section_id == "acceptance":
            status = "changed"
            evidence = "Storybookで状態を確認できるようにする。"
        else:
            status = "unchanged"
            evidence = None
        entries.append(
            {"id": section_id, "status": status, "issue_evidence": evidence}
        )
    return entries


def manifest(
    *,
    issue_body: str = ISSUE_BODY,
    baseline: str | None = BASELINE,
    requirements: list[dict[str, object]] | None = None,
    sections: list[dict[str, object]] | None = None,
    retired: list[dict[str, str]] | None = None,
) -> dict[str, object]:
    if requirements is None:
        requirements = [
            *unchanged_entries(),
            {
                "id": "AC-3",
                "status": "new",
                "issue_evidence": "Storybookで状態を確認できるようにする。",
            },
        ]
    return {
        "issue_body_sha256": hashlib.sha256(issue_body.encode()).hexdigest(),
        "workspace": WORKSPACE,
        "baseline": baseline_manifest(baseline),
        "requirements": requirements,
        "sections": sections if sections is not None else section_entries(),
        "retired": retired or [],
    }


def document(value: dict[str, object], body: str) -> str:
    return (
        f"{body}\n\n## Requirements Completeness Gate\n\n"
        f"```json\n{json.dumps(value, ensure_ascii=False)}\n```\n"
    )


class RequirementsContinuityGateTest(unittest.TestCase):
    def validate_document(
        self,
        value: dict[str, object],
        *,
        kind: str,
        body: str,
        issue_body: str = ISSUE_BODY,
        baseline: str | None = BASELINE,
        canonical: bool = True,
        canonical_symlink: bool = False,
        goal_manifest: dict[str, object] | None = None,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            canonical_path = initialize_repo(repo_root, baseline)
            issue_path = repo_root / "issue.md"
            issue_path.write_text(issue_body, encoding="utf-8")
            if canonical_symlink:
                document_target = repo_root / "temporary-requirements.md"
                document_target.write_text(document(value, body), encoding="utf-8")
                canonical_path.unlink()
                canonical_path.symlink_to(document_target)
                document_path = canonical_path
            else:
                document_path = canonical_path if canonical else repo_root / "document.md"
            document_path.parent.mkdir(parents=True, exist_ok=True)
            if not canonical_symlink:
                document_path.write_text(document(value, body), encoding="utf-8")
            goal_path = None
            if kind == "artifact":
                goal_path = repo_root / "goal.md"
                goal_path.write_text(
                    document(goal_manifest or value, body),
                    encoding="utf-8",
                )
            validate(
                ISSUE,
                issue_path,
                document_path,
                kind,
                repo_root,
                WORKSPACE,
                goal_path,
            )

    def test_goal_accepts_complete_transition_inventory(self) -> None:
        self.validate_document(manifest(), kind="goal", body=CURRENT, canonical=False)

    def test_goal_rejects_local_requirement_definitions(self) -> None:
        local_goal = """# Goal

## Requirement Scope

- AC-3: Storybookで状態を確認できるようにする。
"""
        with self.assertRaisesRegex(ValidationError, "must exactly match"):
            self.validate_document(
                manifest(),
                kind="goal",
                body=local_goal,
                canonical=False,
            )

    def test_artifact_accepts_complete_replacement(self) -> None:
        self.validate_document(manifest(), kind="artifact", body=CURRENT)

    def test_artifact_rejects_git_baseline_declared_as_none(self) -> None:
        value = manifest()
        value["baseline"] = baseline_manifest(None)
        with self.assertRaisesRegex(ValidationError, "source must be git_head"):
            self.validate_document(value, kind="artifact", body=CURRENT)

    def test_artifact_rejects_changed_content_marked_unchanged(self) -> None:
        changed = CURRENT.replace(
            "### FR-2: 言語設定を復元する",
            "### FR-2: 言語設定を必ず復元する",
        )
        with self.assertRaisesRegex(ValidationError, "unchanged requirement content changed"):
            self.validate_document(manifest(), kind="artifact", body=changed)

    def test_artifact_rejects_removed_bullet_continuation_marked_unchanged(self) -> None:
        changed = CURRENT.replace("  - 保存済みの選択値と一致する。\n", "")
        with self.assertRaisesRegex(ValidationError, "unchanged requirement content changed"):
            self.validate_document(manifest(), kind="artifact", body=changed)

    def test_artifact_rejects_a_different_goal_gate(self) -> None:
        goal_value = manifest()
        artifact_value = manifest()
        artifact_value["requirements"] = [
            *unchanged_entries(),
            {
                "id": "AC-3",
                "status": "new",
                "issue_evidence": "Storybookで状態を確認できるようにする。",
            },
        ]
        artifact_value["sections"] = section_entries()
        goal_value["requirements"] = list(reversed(artifact_value["requirements"]))

        with self.assertRaisesRegex(ValidationError, "does not match the Goal"):
            self.validate_document(
                artifact_value,
                kind="artifact",
                body=CURRENT,
                goal_manifest=goal_value,
            )

    def test_artifact_rejects_changed_major_section_marked_unchanged(self) -> None:
        changed = CURRENT.replace(
            "言語設定が永続化されていない。",
            "課題の詳細を省略する。",
        )
        with self.assertRaisesRegex(ValidationError, "unchanged Requirements section changed"):
            self.validate_document(manifest(), kind="artifact", body=changed)

    def test_artifact_accepts_changed_content_with_issue_evidence(self) -> None:
        issue_body = f"{ISSUE_BODY}\n言語設定を必ず復元する\n"
        changed = CURRENT.replace(
            "### FR-2: 言語設定を復元する",
            "### FR-2: 言語設定を必ず復元する",
        )
        requirements = unchanged_entries()
        requirements[1] = {
            "id": "FR-2",
            "status": "changed",
            "issue_evidence": "言語設定を必ず復元する",
        }
        requirements.append(
            {
                "id": "AC-3",
                "status": "new",
                "issue_evidence": "Storybookで状態を確認できるようにする。",
            }
        )
        self.validate_document(
            manifest(
                issue_body=issue_body,
                requirements=requirements,
                sections=section_entries(
                    changed={"functional": "言語設定を必ず復元する"}
                ),
            ),
            kind="artifact",
            body=changed,
            issue_body=issue_body,
        )

    def test_artifact_rejects_issue_evidence_unrelated_to_target_requirement(
        self,
    ) -> None:
        issue_body = f"{ISSUE_BODY}\n保存失敗を成功扱いにしない。\n"
        requirements = [
            *unchanged_entries(),
            {
                "id": "AC-3",
                "status": "new",
                "issue_evidence": "保存失敗を成功扱いにしない。",
            },
        ]
        with self.assertRaisesRegex(
            ValidationError,
            "AC-3 issue_evidence is not present in its requirement content",
        ):
            self.validate_document(
                manifest(issue_body=issue_body, requirements=requirements),
                kind="artifact",
                body=CURRENT,
                issue_body=issue_body,
            )

    def test_goal_rejects_reused_issue_evidence_for_requirements(self) -> None:
        requirements = unchanged_entries()
        requirements[1] = {
            "id": "FR-2",
            "status": "changed",
            "issue_evidence": "Storybookで状態を確認できるようにする。",
        }
        requirements.append(
            {
                "id": "AC-3",
                "status": "new",
                "issue_evidence": "Storybookで状態を確認できるようにする。",
            }
        )
        body = CURRENT.replace(
            "### FR-2: 言語設定を復元する",
            "### FR-2: Storybookで状態を確認できるようにする。",
        )
        with self.assertRaisesRegex(ValidationError, "also maps to another requirement"):
            self.validate_document(
                manifest(requirements=requirements),
                kind="goal",
                body=body,
                canonical=False,
            )

    def test_artifact_rejects_section_evidence_from_another_section(self) -> None:
        issue_body = f"{ISSUE_BODY}\n言語設定を必ず復元する\n保存失敗を成功扱いにしない。\n"
        changed = CURRENT.replace(
            "### FR-2: 言語設定を復元する",
            "### FR-2: 言語設定を必ず復元する",
        )
        requirements = unchanged_entries()
        requirements[1] = {
            "id": "FR-2",
            "status": "changed",
            "issue_evidence": "言語設定を必ず復元する",
        }
        requirements.append(
            {
                "id": "AC-3",
                "status": "new",
                "issue_evidence": "Storybookで状態を確認できるようにする。",
            }
        )
        sections = section_entries(
            changed={
                "functional": "Storybookで状態を確認できるようにする。",
                "acceptance": "保存失敗を成功扱いにしない。",
            }
        )
        with self.assertRaisesRegex(
            ValidationError,
            "functional section evidence is not present in its section content",
        ):
            self.validate_document(
                manifest(
                    issue_body=issue_body,
                    requirements=requirements,
                    sections=sections,
                ),
                kind="artifact",
                body=changed,
                issue_body=issue_body,
            )

    def test_artifact_rejects_reused_issue_evidence_for_sections(self) -> None:
        sections = section_entries(
            changed={
                "functional": "Storybookで状態を確認できるようにする。",
                "acceptance": "Storybookで状態を確認できるようにする。",
            }
        )
        with self.assertRaisesRegex(ValidationError, "also maps to another section"):
            self.validate_document(
                manifest(sections=sections),
                kind="artifact",
                body=CURRENT.replace(
                    "## 機能要件\n\n",
                    "## 機能要件\n\n"
                    "Storybookで状態を確認できるようにする。\n\n",
                ),
            )

    def test_rejects_non_string_requirement_status(self) -> None:
        value = manifest()
        value["requirements"][-1]["status"] = []
        with self.assertRaisesRegex(ValidationError, r"requirements\[5\].status"):
            self.validate_document(value, kind="goal", body=CURRENT, canonical=False)

    def test_rejects_non_string_section_status(self) -> None:
        value = manifest()
        value["sections"][0]["status"] = {}
        with self.assertRaisesRegex(ValidationError, r"sections\[0\].status"):
            self.validate_document(value, kind="artifact", body=CURRENT)

    def test_artifact_rejects_id_only_definition(self) -> None:
        local = CURRENT.replace(
            "### FR-2: 言語設定を復元する",
            "### FR-2",
        )
        with self.assertRaisesRegex(ValidationError, "substantive summary"):
            self.validate_document(manifest(), kind="artifact", body=local)

    def test_artifact_rejects_missing_required_section(self) -> None:
        local = re_sub_section(CURRENT, "## Q&Aログ", "## 技術的考慮事項")
        with self.assertRaisesRegex(ValidationError, "exactly one qa section"):
            self.validate_document(manifest(), kind="artifact", body=local)

    def test_artifact_rejects_heading_shared_by_required_sections(self) -> None:
        local = CURRENT.replace(
            "## 背景と課題",
            "## 背景と課題 / スコープ",
        ).replace(
            "## スコープ\n\n言語設定の保存と復元を対象にする。\n\n",
            "",
        )
        with self.assertRaisesRegex(ValidationError, "map one-to-one to headings"):
            self.validate_document(manifest(), kind="artifact", body=local)

    def test_artifact_accepts_requirement_scope_metadata_heading(self) -> None:
        local = f"{CURRENT}\n\n## Requirement Scope\n\n要求全体を確認する。"
        self.validate_document(manifest(), kind="artifact", body=local)

    def test_retirement_requires_id_and_explicit_term(self) -> None:
        issue_body = f"{ISSUE_BODY}\n復元は今回扱わない。\n"
        requirements = [
            *unchanged_entries(["FR-1", "NFR-1", "AC-1", "AC-2"]),
            {
                "id": "AC-3",
                "status": "new",
                "issue_evidence": "Storybookで状態を確認できるようにする。",
            },
        ]
        retired = [{"id": "FR-2", "issue_evidence": "復元は今回扱わない。"}]
        with self.assertRaisesRegex(ValidationError, "must name its requirement ID"):
            self.validate_document(
                manifest(
                    issue_body=issue_body,
                    requirements=requirements,
                    sections=section_entries(
                        changed={"functional": "FR-2を対象外として廃止する。"}
                    ),
                    retired=retired,
                ),
                kind="goal",
                body=CURRENT.replace("### FR-2: 言語設定を復元する\n\n保存済みの選択値を初期表示する。\n\n", ""),
                issue_body=issue_body,
                canonical=False,
            )

    def test_artifact_accepts_explicit_retirement(self) -> None:
        issue_body = f"{ISSUE_BODY}\nFR-2を対象外として廃止する。\n"
        requirements = [
            *unchanged_entries(["FR-1", "NFR-1", "AC-1", "AC-2"]),
            {
                "id": "AC-3",
                "status": "new",
                "issue_evidence": "Storybookで状態を確認できるようにする。",
            },
        ]
        retired = [{"id": "FR-2", "issue_evidence": "FR-2を対象外として廃止する。"}]
        current = CURRENT.replace(
            "### FR-2: 言語設定を復元する\n\n保存済みの選択値を初期表示する。\n\n",
            "",
        )
        current = current.replace(
            "## 機能要件\n\n",
            "## 機能要件\n\nFR-2を対象外として廃止する。\n\n",
        )
        self.validate_document(
            manifest(
                issue_body=issue_body,
                requirements=requirements,
                sections=section_entries(
                    changed={"functional": "FR-2を対象外として廃止する。"}
                ),
                retired=retired,
            ),
            kind="artifact",
            body=current,
            issue_body=issue_body,
        )

    def test_retirement_rejects_japanese_negation(self) -> None:
        requirements = [
            *unchanged_entries(["FR-1", "NFR-1", "AC-1", "AC-2"]),
            {
                "id": "AC-3",
                "status": "new",
                "issue_evidence": "Storybookで状態を確認できるようにする。",
            },
        ]
        for evidence in (
            "FR-2は削除しない。",
            "FR-2は削除をしない。",
            "FR-2の削除は不要。",
            "FR-2は不要ではない。",
            "FR-2は対象外とはしない。",
        ):
            with self.subTest(evidence=evidence):
                issue_body = f"{ISSUE_BODY}\n{evidence}\n"
                with self.assertRaisesRegex(
                    ValidationError, "must not negate retirement"
                ):
                    self.validate_document(
                        manifest(
                            issue_body=issue_body,
                            requirements=requirements,
                            retired=[{"id": "FR-2", "issue_evidence": evidence}],
                        ),
                        kind="goal",
                        body=CURRENT.replace(
                            "### FR-2: 言語設定を復元する\n\n"
                            "保存済みの選択値を初期表示する。\n\n",
                            "",
                        ),
                        issue_body=issue_body,
                        canonical=False,
                    )

    def test_retirement_rejects_english_negation(self) -> None:
        requirements = [
            *unchanged_entries(["FR-1", "NFR-1", "AC-1", "AC-2"]),
            {
                "id": "AC-3",
                "status": "new",
                "issue_evidence": "Storybookで状態を確認できるようにする。",
            },
        ]
        for evidence in (
            "FR-2 must not be removed.",
            "FR-2 is not out of scope.",
            "FR-2 shouldn't be removed.",
            "FR-2 isn't out of scope.",
        ):
            with self.subTest(evidence=evidence):
                issue_body = f"{ISSUE_BODY}\n{evidence}\n"
                with self.assertRaisesRegex(
                    ValidationError, "must not negate retirement"
                ):
                    self.validate_document(
                        manifest(
                            issue_body=issue_body,
                            requirements=requirements,
                            retired=[{"id": "FR-2", "issue_evidence": evidence}],
                        ),
                        kind="goal",
                        body=CURRENT.replace(
                            "### FR-2: 言語設定を復元する\n\n"
                            "保存済みの選択値を初期表示する。\n\n",
                            "",
                        ),
                        issue_body=issue_body,
                        canonical=False,
                    )

    def test_first_cycle_accepts_git_verified_missing_baseline(self) -> None:
        issue_body = "\n".join(
            dict.fromkeys(
                [
                    *FIRST_CYCLE_REQUIREMENT_EVIDENCE.values(),
                    *FIRST_CYCLE_SECTION_EVIDENCE.values(),
                ]
            )
        )
        requirements = [
            {
                "id": requirement_id,
                "status": "new",
                "issue_evidence": FIRST_CYCLE_REQUIREMENT_EVIDENCE[requirement_id],
            }
            for requirement_id in BASELINE_IDS
        ]
        requirements.append(
            {
                "id": "AC-3",
                "status": "new",
                "issue_evidence": FIRST_CYCLE_REQUIREMENT_EVIDENCE["AC-3"],
            }
        )
        self.validate_document(
            manifest(
                issue_body=issue_body,
                baseline=None,
                requirements=requirements,
                sections=section_entries(baseline=False),
            ),
            kind="artifact",
            body=CURRENT,
            issue_body=issue_body,
            baseline=None,
        )

    def test_artifact_rejects_noncanonical_path(self) -> None:
        with self.assertRaisesRegex(ValidationError, "canonical repository path"):
            self.validate_document(
                manifest(),
                kind="artifact",
                body=CURRENT,
                canonical=False,
            )

    def test_artifact_rejects_canonical_path_symlink(self) -> None:
        with self.assertRaisesRegex(ValidationError, "must not contain symlinks"):
            self.validate_document(
                manifest(),
                kind="artifact",
                body=CURRENT,
                canonical_symlink=True,
            )

    def test_cli_accepts_complete_replacement(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            canonical_path = initialize_repo(repo_root, BASELINE)
            issue_path = repo_root / "issue.md"
            issue_path.write_text(ISSUE_BODY, encoding="utf-8")
            canonical_path.write_text(document(manifest(), CURRENT), encoding="utf-8")
            goal_path = repo_root / "goal.md"
            goal_path.write_text(document(manifest(), CURRENT), encoding="utf-8")
            result = subprocess.run(
                [
                    sys.executable,
                    str(VALIDATOR_PATH),
                    "--issue",
                    ISSUE,
                    "--issue-body",
                    str(issue_path),
                    "--document",
                    str(canonical_path),
                    "--kind",
                    "artifact",
                    "--repo-root",
                    str(repo_root),
                    "--workspace",
                    WORKSPACE,
                    "--goal-document",
                    str(goal_path),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_cli_rejects_non_string_status_without_traceback(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            canonical_path = initialize_repo(repo_root, BASELINE)
            issue_path = repo_root / "issue.md"
            issue_path.write_text(ISSUE_BODY, encoding="utf-8")
            value = manifest()
            value["sections"][0]["status"] = []
            canonical_path.write_text(document(value, CURRENT), encoding="utf-8")
            goal_path = repo_root / "goal.md"
            goal_path.write_text(document(value, CURRENT), encoding="utf-8")
            result = subprocess.run(
                [
                    sys.executable,
                    str(VALIDATOR_PATH),
                    "--issue",
                    ISSUE,
                    "--issue-body",
                    str(issue_path),
                    "--document",
                    str(canonical_path),
                    "--kind",
                    "artifact",
                    "--repo-root",
                    str(repo_root),
                    "--workspace",
                    WORKSPACE,
                    "--goal-document",
                    str(goal_path),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 1)
        self.assertIn("sections[0].status must be a non-empty string", result.stderr)
        self.assertTrue(
            result.stderr.rstrip().endswith(
                "requirements completeness gate: failed: "
                "sections[0].status must be a non-empty string"
            )
        )


def re_sub_section(document_body: str, start: str, end: str) -> str:
    start_index = document_body.index(start)
    end_index = document_body.index(end, start_index)
    return f"{document_body[:start_index]}{document_body[end_index:]}"


if __name__ == "__main__":
    unittest.main()
