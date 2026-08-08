from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from validate_requirements_goal import ValidationError, validate


REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
RULE_MAP_PATH = REPOSITORY_ROOT / "docs/harness/rule-map.json"
VALIDATOR_PATH = Path(__file__).with_name("validate_requirements_goal.py")
ISSUE = "kosnu/savings#1563"
ISSUE_URL = "https://github.com/kosnu/savings/issues/1563"
ISSUE_UPDATED_AT = "2026-08-06T00:00:00Z"
ISSUE_BODY = (
    "# 言語設定を保存する\n\n"
    "user の言語設定を `public.users.language` に保存する。\n\n"
    "test で言語設定の保存と復元を確認する。\n"
)
PAYMENT_ISSUE_BODY = "payment の金額、日付、categoryを保存する。\n"


def manifest(
    direct_rules: list[dict[str, object]],
    *,
    issue_body: str = ISSUE_BODY,
    depends_on: list[dict[str, str]] | None = None,
    issue: str = ISSUE,
    issue_url: str = ISSUE_URL,
    issue_updated_at: str = ISSUE_UPDATED_AT,
) -> dict[str, object]:
    return {
        "task_context": {
            "source": "issue_body",
            "issue": issue,
            "url": issue_url,
            "updated_at": issue_updated_at,
            "body_sha256": hashlib.sha256(issue_body.encode()).hexdigest(),
        },
        "direct_rules": direct_rules,
        "depends_on": depends_on or [],
    }


def payment_direct_rule() -> dict[str, object]:
    return {
        "id": "domain.payment",
        "issue_evidence": PAYMENT_ISSUE_BODY.strip(),
        "match": {"field": "topics", "value": "payment"},
        "reason": "payment domainの要求だから",
    }


def user_direct_rule(issue_evidence: str | None = None) -> dict[str, object]:
    return {
        "id": "domain.user",
        "issue_evidence": issue_evidence
        or "user の言語設定を `public.users.language` に保存する。",
        "match": {"field": "domains", "value": "user"},
        "reason": "user domainの要求だから",
    }


def payment_dependencies() -> list[dict[str, str]]:
    return [
        {"id": "domain.amount", "via": "domain.payment"},
        {"id": "domain.date", "via": "domain.payment"},
        {"id": "domain.category", "via": "domain.payment"},
    ]


class RequirementsInputGateTest(unittest.TestCase):
    def validate_manifest(
        self,
        value: dict[str, object],
        *,
        issue_body: str = ISSUE_BODY,
        issue: str = ISSUE,
        issue_url: str = ISSUE_URL,
        issue_updated_at: str = ISSUE_UPDATED_AT,
        kind: str = "goal",
        goal_manifest: dict[str, object] | None = None,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            directory_path = Path(directory)
            issue_path = directory_path / "issue.md"
            document_path = directory_path / (
                "requirements.md" if kind == "artifact" else "goal.md"
            )
            issue_path.write_text(issue_body, encoding="utf-8")
            document_path.write_text(
                "## Requirements Input Gate\n\n"
                f"```json\n{json.dumps(value, ensure_ascii=False)}\n```\n",
                encoding="utf-8",
            )
            goal_path = None
            if kind == "artifact":
                goal_path = directory_path / "goal.md"
                goal_path.write_text(
                    "## Requirements Input Gate\n\n"
                    f"```json\n{json.dumps(goal_manifest or value, ensure_ascii=False)}\n```\n",
                    encoding="utf-8",
                )
            validate(
                issue_path,
                document_path,
                RULE_MAP_PATH,
                issue,
                issue_url,
                issue_updated_at,
                kind,
                goal_path,
            )

    def test_accepts_issue_evidenced_domain_rule(self) -> None:
        self.validate_manifest(manifest([user_direct_rule()]))

    def test_rejects_empty_direct_rules(self) -> None:
        with self.assertRaisesRegex(ValidationError, "at least one"):
            self.validate_manifest(manifest([]))

    def test_rejects_match_value_missing_from_issue_evidence(self) -> None:
        value = manifest(
            [
                {
                    "id": "domain.payment",
                    "issue_evidence": "設定画面の説明文を変更する。",
                    "match": {"field": "topics", "value": "payment"},
                    "reason": "直前の会話でpaymentが話題だったため",
                }
            ],
            issue_body="設定画面の説明文を変更する。\n",
        )

        with self.assertRaisesRegex(
            ValidationError,
            "match.value must be present in Issue evidence",
        ):
            self.validate_manifest(value, issue_body="設定画面の説明文を変更する。\n")

    def test_rejects_recent_msw_context_without_issue_evidence(self) -> None:
        with self.assertRaisesRegex(
            ValidationError,
            "explicit_surface must be explicitly present in Issue evidence",
        ):
            self.validate_manifest(
                manifest(
                    [
                        {
                            "id": "web.msw-handlers",
                            "issue_evidence": (
                                "test で言語設定の保存と復元を確認する。"
                            ),
                            "match": {"field": "topics", "value": "test"},
                            "reason": "直前の会話で更新済みだったため",
                            "explicit_surface": "msw",
                        }
                    ]
                )
            )

    def test_accepts_complete_dependency_closure(self) -> None:
        self.validate_manifest(
            manifest(
                [payment_direct_rule()],
                issue_body=PAYMENT_ISSUE_BODY,
                depends_on=payment_dependencies(),
            ),
            issue_body=PAYMENT_ISSUE_BODY,
        )

    def test_accepts_dependency_that_is_also_a_direct_rule(self) -> None:
        issue_body = "payment amount date category を変更する。\n"
        direct_rules = [
            {
                "id": rule_id,
                "issue_evidence": issue_body.strip(),
                "match": {"field": "topics", "value": topic},
                "reason": f"{topic} domainの要求だから",
            }
            for rule_id, topic in [
                ("domain.payment", "payment"),
                ("domain.amount", "amount"),
                ("domain.date", "date"),
                ("domain.category", "category"),
            ]
        ]

        self.validate_manifest(
            manifest(direct_rules, issue_body=issue_body),
            issue_body=issue_body,
        )

    def test_accepts_shared_dependency_once(self) -> None:
        issue_body = "payment budget amount date category を変更する。\n"
        direct_rules = [
            payment_direct_rule(),
            {
                "id": "domain.monthly-budget",
                "issue_evidence": issue_body.strip(),
                "match": {"field": "topics", "value": "budget"},
                "reason": "budget domainの要求だから",
            },
        ]
        direct_rules[0]["issue_evidence"] = issue_body.strip()
        dependencies = [
            {"id": "domain.amount", "via": "domain.payment"},
            {"id": "domain.date", "via": "domain.monthly-budget"},
            {"id": "domain.category", "via": "domain.payment"},
            {"id": "policy.temporal-data", "via": "domain.monthly-budget"},
        ]

        self.validate_manifest(
            manifest(
                direct_rules,
                issue_body=issue_body,
                depends_on=dependencies,
            ),
            issue_body=issue_body,
        )

    def test_rejects_missing_dependency_closure(self) -> None:
        value = manifest([payment_direct_rule()], issue_body=PAYMENT_ISSUE_BODY)

        with self.assertRaisesRegex(ValidationError, "missing required nodes"):
            self.validate_manifest(value, issue_body=PAYMENT_ISSUE_BODY)

    def test_rejects_dependency_with_unselected_via(self) -> None:
        dependencies = payment_dependencies()
        dependencies[0] = {
            "id": "domain.amount",
            "via": "domain.monthly-budget",
        }
        value = manifest(
            [payment_direct_rule()],
            issue_body=PAYMENT_ISSUE_BODY,
            depends_on=dependencies,
        )

        with self.assertRaisesRegex(ValidationError, "via must reference a selected"):
            self.validate_manifest(value, issue_body=PAYMENT_ISSUE_BODY)

    def test_rejects_dependency_outside_required_closure(self) -> None:
        value = manifest(
            [
                {
                    "id": "domain.user",
                    "issue_evidence": "user の設定を変更する。",
                    "match": {"field": "domains", "value": "user"},
                    "reason": "user domainの要求だから",
                }
            ],
            issue_body="user の設定を変更する。\n",
            depends_on=[{"id": "domain.amount", "via": "domain.payment"}],
        )

        with self.assertRaisesRegex(ValidationError, "outside the required closure"):
            self.validate_manifest(value, issue_body="user の設定を変更する。\n")

    def test_rejects_duplicate_dependency(self) -> None:
        dependencies = payment_dependencies()
        dependencies.append({"id": "domain.amount", "via": "domain.payment"})
        value = manifest(
            [payment_direct_rule()],
            issue_body=PAYMENT_ISSUE_BODY,
            depends_on=dependencies,
        )

        with self.assertRaisesRegex(ValidationError, "duplicate rule-map node"):
            self.validate_manifest(value, issue_body=PAYMENT_ISSUE_BODY)

    def test_rejects_manifest_issue_metadata_mismatch(self) -> None:
        value = manifest([user_direct_rule()], issue="kosnu/savings#1")

        with self.assertRaisesRegex(ValidationError, "does not match the fetched"):
            self.validate_manifest(value)

    def test_rejects_manifest_url_metadata_mismatch(self) -> None:
        value = manifest(
            [user_direct_rule()],
            issue_url="https://github.com/kosnu/savings/issues/1",
        )

        with self.assertRaisesRegex(ValidationError, "does not match the fetched"):
            self.validate_manifest(value)

    def test_rejects_manifest_updated_at_metadata_mismatch(self) -> None:
        value = manifest(
            [user_direct_rule()],
            issue_updated_at="2026-08-07T00:00:00Z",
        )

        with self.assertRaisesRegex(ValidationError, "does not match the fetched"):
            self.validate_manifest(value)

    def test_rejects_noncanonical_issue_url(self) -> None:
        mismatched_url = "https://github.com/kosnu/savings/issues/999"
        value = manifest([user_direct_rule()], issue_url=mismatched_url)

        with self.assertRaisesRegex(ValidationError, "URL does not match"):
            self.validate_manifest(value, issue_url=mismatched_url)

    def test_rejects_invalid_issue_updated_at(self) -> None:
        value = manifest([user_direct_rule()], issue_updated_at="not-a-timestamp")

        with self.assertRaisesRegex(ValidationError, "RFC 3339 UTC"):
            self.validate_manifest(value, issue_updated_at="not-a-timestamp")

    def test_rejects_incomplete_issue_updated_at(self) -> None:
        value = manifest([user_direct_rule()], issue_updated_at="2026-08-06Z")

        with self.assertRaisesRegex(ValidationError, "RFC 3339 UTC"):
            self.validate_manifest(value, issue_updated_at="2026-08-06Z")

    def test_rejects_non_issue_task_context_key(self) -> None:
        value = manifest([user_direct_rule()])
        value["conversation"] = "直前の会話"

        with self.assertRaisesRegex(ValidationError, "non-Issue input keys"):
            self.validate_manifest(value)

    def test_artifact_accepts_the_same_goal_gate(self) -> None:
        value = manifest([user_direct_rule()])
        self.validate_manifest(value, kind="artifact", goal_manifest=value)

    def test_artifact_rejects_a_different_valid_goal_gate(self) -> None:
        issue_body = "user payment amount date category を変更する。\n"
        goal_rule = user_direct_rule(issue_body.strip())
        artifact_rule = payment_direct_rule()
        artifact_rule["issue_evidence"] = issue_body.strip()
        goal_value = manifest([goal_rule], issue_body=issue_body)
        artifact_value = manifest(
            [artifact_rule],
            issue_body=issue_body,
            depends_on=payment_dependencies(),
        )

        with self.assertRaisesRegex(ValidationError, "does not match the Goal"):
            self.validate_manifest(
                artifact_value,
                issue_body=issue_body,
                kind="artifact",
                goal_manifest=goal_value,
            )

    def test_cli_artifact_accepts_matching_goal_gate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            directory_path = Path(directory)
            issue_path = directory_path / "issue.md"
            goal_path = directory_path / "goal.md"
            artifact_path = directory_path / "requirements.md"
            value = manifest([user_direct_rule()])
            gate = (
                "## Requirements Input Gate\n\n"
                f"```json\n{json.dumps(value, ensure_ascii=False)}\n```\n"
            )
            issue_path.write_text(ISSUE_BODY, encoding="utf-8")
            goal_path.write_text(gate, encoding="utf-8")
            artifact_path.write_text(gate, encoding="utf-8")
            result = subprocess.run(
                [
                    sys.executable,
                    str(VALIDATOR_PATH),
                    "--issue",
                    ISSUE,
                    "--issue-url",
                    ISSUE_URL,
                    "--issue-updated-at",
                    ISSUE_UPDATED_AT,
                    "--issue-body",
                    str(issue_path),
                    "--document",
                    str(artifact_path),
                    "--rule-map",
                    str(RULE_MAP_PATH),
                    "--kind",
                    "artifact",
                    "--goal-document",
                    str(goal_path),
                ],
                capture_output=True,
                text=True,
                check=False,
            )

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_cli_accepts_fetched_issue_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            directory_path = Path(directory)
            issue_path = directory_path / "issue.md"
            document_path = directory_path / "goal.md"
            issue_path.write_text(ISSUE_BODY, encoding="utf-8")
            document_path.write_text(
                "## Requirements Input Gate\n\n"
                f"```json\n{json.dumps(manifest([user_direct_rule()]), ensure_ascii=False)}\n```\n",
                encoding="utf-8",
            )
            result = subprocess.run(
                [
                    sys.executable,
                    str(VALIDATOR_PATH),
                    "--issue",
                    ISSUE,
                    "--issue-url",
                    ISSUE_URL,
                    "--issue-updated-at",
                    ISSUE_UPDATED_AT,
                    "--issue-body",
                    str(issue_path),
                    "--document",
                    str(document_path),
                    "--rule-map",
                    str(RULE_MAP_PATH),
                    "--kind",
                    "goal",
                ],
                capture_output=True,
                text=True,
                check=False,
            )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "requirements input gate: ok")


if __name__ == "__main__":
    unittest.main()
