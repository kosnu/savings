from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from artifact_source import SourceError, serialize_source
from validate_requirements_goal import ValidationError, validate


ISSUE = "owner/repo#1639"
ISSUE_URL = "https://github.com/owner/repo/issues/1639"
UPDATED_AT = "2026-08-09T06:19:50Z"
ISSUE_BODY = "user の設定を保存する。\npayment の金額を保存する。\n"
WORKSPACE = "1639-structured-data"


def run_git(repo_root: Path, *arguments: str) -> None:
    subprocess.run(
        ["git", "-C", str(repo_root), *arguments],
        check=True,
        capture_output=True,
    )


def initialize_repo(repo_root: Path) -> Path:
    run_git(repo_root, "init", "-q")
    run_git(repo_root, "config", "user.name", "AIDD Test")
    run_git(repo_root, "config", "user.email", "aidd@example.com")
    rule_map = repo_root / "docs" / "harness" / "rule-map.json"
    rule_map.parent.mkdir(parents=True)
    rule_map.write_text(
        json.dumps(
            {
                "rules": [
                    {
                        "id": "domain.user",
                        "file": "docs/user.md",
                        "applies_to": {
                            "paths": [],
                            "domains": ["user"],
                            "activities": [],
                            "topics": [],
                        },
                        "depends_on": [],
                    },
                    {
                        "id": "domain.payment",
                        "file": "docs/payment.md",
                        "applies_to": {
                            "paths": [],
                            "domains": ["payment"],
                            "activities": [],
                            "topics": [],
                        },
                        "depends_on": ["policy.base"],
                    },
                    {
                        "id": "policy.base",
                        "file": "docs/base.md",
                        "applies_to": {
                            "paths": [],
                            "domains": [],
                            "activities": ["validation"],
                            "topics": [],
                        },
                        "depends_on": [],
                    },
                ]
            }
        ),
        encoding="utf-8",
    )
    run_git(repo_root, "add", "docs/harness/rule-map.json")
    run_git(repo_root, "commit", "-qm", "baseline")
    return rule_map


def input_gate(*, direct: bool = True) -> dict[str, object]:
    return {
        "task_context": {
            "source": "issue_body",
            "issue": ISSUE,
            "url": ISSUE_URL,
            "updated_at": UPDATED_AT,
            "body_sha256": hashlib.sha256(ISSUE_BODY.encode()).hexdigest(),
        },
        "direct_rules": (
            [
                {
                    "id": "domain.user",
                    "issue_evidence": "user の設定を保存する。",
                    "match": {"field": "domains", "value": "user"},
                    "reason": "Issueがuser domainを明示するため",
                }
            ]
            if direct
            else []
        ),
        "depends_on": [],
    }


def source(
    kind: str,
    gate: dict[str, object],
    preamble: str = "---\ntitle: display\n---\n\n# display",
) -> dict[str, object]:
    validation: dict[str, object] = {
        "mode": "managed",
        "input_gate": gate,
        "completeness_gate": {
            "issue_body_sha256": "0" * 64,
            "workspace": WORKSPACE,
            "baseline": {"source": "none", "body_sha256": None},
            "requirements": [
                {"id": "FR-1", "status": "new", "issue_evidence": "scope"}
            ],
            "sections": [],
            "retired": [],
        },
        "requirements": (
            [{"id": "FR-1", "text": "fixture"}]
            if kind == "requirements_goal"
            else [{"id": "FR-1", "section_id": "functional", "text": "fixture"}]
        ),
    }
    if kind == "requirements":
        validation["completeness_gate"]["sections"] = [
            {"id": "functional", "status": "new", "issue_evidence": "scope"}
        ]
        validation.update(
            {
                "sections": [
                    {
                        "id": "functional",
                        "heading": "機能要件",
                        "blocks": [
                            {
                                "id": "functional-requirements",
                                "type": "requirements",
                            }
                        ],
                    }
                ],
            }
        )
        display = {"path": "requirements.md", "preamble": preamble}
    else:
        display = {
            "path": "goal.md",
            "title": "Requirements Goal",
            "goal": "Issue本文を正本にRequirementsを作成する。",
            "context": {
                "body": ["Issue本文とrule-mapを検証する。"],
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
                        "text": "workspaceまたはRequirements Gateの検証が失敗した場合は停止する。",
                    },
                    {
                        "id": "scope-ambiguity",
                        "text": "Issue本文から要求scopeを一意に決められない場合は停止する。",
                    },
                ],
            },
            "done": [
                {
                    "id": "complete-scope",
                    "text": "最新Issue全体を覆うRequirementsと全要求IDを定義する。",
                },
                {
                    "id": "validated-artifact",
                    "text": "Requirements Gateと生成成果物の同期検証を成功させる。",
                },
            ],
        }
    return {
        "schema_version": 2,
        "kind": kind,
        "workspace": WORKSPACE,
        "display": display,
        "validation": validation,
    }


class RequirementsInputGateTest(unittest.TestCase):
    def validate_source(
        self,
        gate: dict[str, object],
        *,
        kind: str = "goal",
        goal_gate: dict[str, object] | None = None,
        preamble: str = "---\ntitle: display\n---\n\n# display",
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            rule_map = initialize_repo(repo_root)
            issue_path = repo_root / "issue.md"
            issue_path.write_text(ISSUE_BODY, encoding="utf-8")
            if kind == "goal":
                document = repo_root / "goal.json"
                document.write_text(
                    serialize_source(source("requirements_goal", gate, preamble)),
                    encoding="utf-8",
                )
                goal_document = None
            else:
                document = (
                    repo_root
                    / "docs"
                    / "ai-driven-development"
                    / "workspaces"
                    / WORKSPACE
                    / "requirements.json"
                )
                document.parent.mkdir(parents=True)
                document.write_text(
                    serialize_source(source("requirements", gate, preamble)),
                    encoding="utf-8",
                )
                goal_document = repo_root / "goal.json"
                goal_document.write_text(
                    serialize_source(
                        source("requirements_goal", goal_gate or gate)
                    ),
                    encoding="utf-8",
                )
            validate(
                issue_path,
                document,
                rule_map,
                ISSUE,
                ISSUE_URL,
                UPDATED_AT,
                kind,
                repo_root,
                goal_document,
            )

    def test_accepts_goal_json(self) -> None:
        self.validate_source(input_gate())

    def test_accepts_artifact_with_matching_goal_json(self) -> None:
        self.validate_source(input_gate(), kind="artifact")

    def test_rejects_empty_direct_rules(self) -> None:
        with self.assertRaisesRegex(SourceError, "must be non-empty"):
            self.validate_source(input_gate(direct=False))

    def test_rejects_artifact_gate_different_from_goal(self) -> None:
        changed = input_gate()
        changed["direct_rules"][0]["reason"] = "別の理由"
        with self.assertRaisesRegex(ValidationError, "does not match the Goal"):
            self.validate_source(changed, kind="artifact", goal_gate=input_gate())

    def test_display_markdown_cannot_supply_rule_evidence(self) -> None:
        gate = input_gate()
        gate["direct_rules"][0]["issue_evidence"] = "displayだけのuser evidence"
        with self.assertRaisesRegex(ValidationError, "not present in the Issue body"):
            self.validate_source(
                gate,
                kind="artifact",
                preamble="```json\ndisplayだけのuser evidence\n```",
            )

    def test_rejects_match_value_missing_from_issue_evidence(self) -> None:
        gate = input_gate()
        gate["direct_rules"][0]["issue_evidence"] = "設定を保存する。"
        with self.assertRaisesRegex(ValidationError, "match.value"):
            self.validate_source(gate)

    def test_rejects_manifest_issue_metadata_mismatch(self) -> None:
        gate = input_gate()
        gate["task_context"]["issue"] = "owner/repo#1640"
        with self.assertRaisesRegex(ValidationError, "does not match"):
            self.validate_source(gate)

    def test_rejects_non_issue_task_context_key(self) -> None:
        gate = input_gate()
        gate["task_context"]["conversation"] = "not allowed"
        with self.assertRaisesRegex(SourceError, "invalid keys"):
            self.validate_source(gate)

    def test_accepts_complete_dependency_closure(self) -> None:
        gate = input_gate()
        gate["direct_rules"] = [
            {
                "id": "domain.payment",
                "issue_evidence": "payment の金額を保存する。",
                "match": {"field": "domains", "value": "payment"},
                "reason": "Issueがpayment domainを明示するため",
            }
        ]
        gate["depends_on"] = [{"id": "policy.base", "via": "domain.payment"}]
        self.validate_source(gate)

    def test_rejects_missing_dependency_closure(self) -> None:
        gate = input_gate()
        gate["direct_rules"] = [
            {
                "id": "domain.payment",
                "issue_evidence": "payment の金額を保存する。",
                "match": {"field": "domains", "value": "payment"},
                "reason": "Issueがpayment domainを明示するため",
            }
        ]
        with self.assertRaisesRegex(ValidationError, "missing required nodes"):
            self.validate_source(gate)

    def test_rejects_legacy_import_mode(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            rule_map = initialize_repo(repo_root)
            issue_path = repo_root / "issue.md"
            issue_path.write_text(ISSUE_BODY, encoding="utf-8")
            value = source("requirements_goal", input_gate())
            value["validation"]["mode"] = "legacy_import"
            document = repo_root / "goal.json"
            document.write_text(
                f"{json.dumps(value, ensure_ascii=False, indent=2)}\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(SourceError, "mode must be managed"):
                validate(
                    issue_path,
                    document,
                    rule_map,
                    ISSUE,
                    ISSUE_URL,
                    UPDATED_AT,
                    "goal",
                    repo_root,
                )


if __name__ == "__main__":
    unittest.main()
