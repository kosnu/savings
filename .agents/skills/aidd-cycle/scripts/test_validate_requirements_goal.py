from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from validate_requirements_goal import ValidationError, validate


REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
RULE_MAP_PATH = REPOSITORY_ROOT / "docs/harness/rule-map.json"
ISSUE_BODY = (
    "# 言語設定を保存する\n\n"
    "ユーザーの言語設定を `public.users.language` に保存する。\n\n"
    "言語設定の保存と復元を回帰テストする。\n"
)


def manifest(direct_rules: list[dict[str, object]]) -> dict[str, object]:
    return {
        "task_context": {
            "source": "issue_body",
            "issue": "kosnu/savings#1563",
            "url": "https://github.com/kosnu/savings/issues/1563",
            "updated_at": "2026-08-06T00:00:00Z",
            "body_sha256": hashlib.sha256(ISSUE_BODY.encode()).hexdigest(),
        },
        "direct_rules": direct_rules,
        "depends_on": [],
    }


class RequirementsInputGateTest(unittest.TestCase):
    def validate_manifest(self, value: dict[str, object]) -> None:
        with tempfile.TemporaryDirectory() as directory:
            directory_path = Path(directory)
            issue_path = directory_path / "issue.md"
            document_path = directory_path / "goal.md"
            issue_path.write_text(ISSUE_BODY, encoding="utf-8")
            document_path.write_text(
                "## Requirements Input Gate\n\n"
                f"```json\n{json.dumps(value, ensure_ascii=False)}\n```\n",
                encoding="utf-8",
            )
            validate(issue_path, document_path, RULE_MAP_PATH)

    def test_accepts_issue_evidenced_domain_rule(self) -> None:
        self.validate_manifest(
            manifest(
                [
                    {
                        "id": "domain.user",
                        "issue_evidence": (
                            "ユーザーの言語設定を `public.users.language` に保存する。"
                        ),
                        "match": {"field": "domains", "value": "user"},
                        "reason": "ユーザーdomainの要求だから",
                    }
                ]
            )
        )

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
                            "issue_evidence": "言語設定の保存と復元を回帰テストする。",
                            "match": {"field": "topics", "value": "test"},
                            "reason": "直前の会話で更新済みだったため",
                            "explicit_surface": "msw",
                        }
                    ]
                )
            )

    def test_rejects_non_issue_task_context_key(self) -> None:
        value = manifest([])
        value["conversation"] = "直前の会話"

        with self.assertRaisesRegex(ValidationError, "non-Issue input keys"):
            self.validate_manifest(value)


if __name__ == "__main__":
    unittest.main()
