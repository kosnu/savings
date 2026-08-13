from __future__ import annotations

import hashlib
import subprocess
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

from artifact_source import serialize_source
from structured_ids import REQUIRED_REQUIREMENTS_SECTIONS
from validate_requirements_continuity import (
    ValidationError,
    structured_sections,
    validate,
)


ISSUE = "owner/repo#1639"
WORKSPACE = "1639-structured-data"
REQUIREMENTS = [
    ("FR-1", "FR-1 JSONを検証正本として扱う。"),
    ("AC-1", "AC-1 表示Markdownだけの変更は検証結果を変えない。"),
]
SECTION_HEADINGS = {
    "background": "背景",
    "users": "対象ユーザー",
    "stories": "ユーザーストーリー",
    "scope": "スコープ",
    "functional": "機能要件",
    "non_functional": "非機能要件",
    "acceptance": "受け入れ条件",
    "qa": "Q&A",
    "technical": "技術的考慮事項",
}
SECTION_EVIDENCE = {
    section_id: f"{section_id} section evidence {index}"
    for index, section_id in enumerate(REQUIRED_REQUIREMENTS_SECTIONS, 1)
}
ISSUE_BODY = "\n".join(
    [content for _, content in REQUIREMENTS] + list(SECTION_EVIDENCE.values())
) + "\n"


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


def completeness_gate() -> dict[str, object]:
    return {
        "issue_body_sha256": hashlib.sha256(ISSUE_BODY.encode()).hexdigest(),
        "workspace": WORKSPACE,
        "baseline": {"source": "none", "body_sha256": None},
        "requirements": [
            {"id": requirement_id, "status": "new", "issue_evidence": content}
            for requirement_id, content in REQUIREMENTS
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
    }


def source(
    kind: str,
    gate: dict[str, object],
    markdown: str = "# display\n",
    requirements: list[tuple[str, str]] | None = None,
) -> dict[str, object]:
    active_requirements = requirements or REQUIREMENTS
    validation: dict[str, object] = {
        "mode": "managed",
        "completeness_gate": gate,
        "requirements": [
            {"id": requirement_id, "content": content}
            for requirement_id, content in active_requirements
        ],
    }
    if kind == "requirements":
        validation["sections"] = [
            {
                "id": section_id,
                "heading": SECTION_HEADINGS[section_id],
                "content": SECTION_EVIDENCE[section_id],
            }
            for section_id in REQUIRED_REQUIREMENTS_SECTIONS
        ]
    return {
        "schema_version": 1,
        "kind": kind,
        "workspace": WORKSPACE,
        "display": {
            "path": "goal.md" if kind == "requirements_goal" else "requirements.md",
            "markdown": markdown,
        },
        "validation": validation,
    }


class RequirementsContinuityGateTest(unittest.TestCase):
    def test_rejects_section_heading_for_another_section_id(self) -> None:
        value = source("requirements", completeness_gate())
        value["validation"]["sections"][4]["heading"] = "非機能要件"

        with self.assertRaisesRegex(ValidationError, "heading does not match"):
            structured_sections(value)

    def validate_source(
        self,
        *,
        kind: str,
        gate: dict[str, object] | None = None,
        markdown: str = "# display\n",
        requirements: list[tuple[str, str]] | None = None,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory)
            initialize_repo(repo_root)
            issue_path = repo_root / "issue.md"
            issue_path.write_text(ISSUE_BODY, encoding="utf-8")
            active_gate = gate or completeness_gate()
            goal_path = repo_root / "goal.json"
            goal_path.write_text(
                serialize_source(
                    source(
                        "requirements_goal",
                        active_gate,
                        requirements=requirements,
                    )
                ),
                encoding="utf-8",
            )
            if kind == "goal":
                document_path = goal_path
                goal_document = None
            else:
                document_path = (
                    repo_root
                    / "docs"
                    / "ai-driven-development"
                    / "workspaces"
                    / WORKSPACE
                    / "requirements.json"
                )
                document_path.parent.mkdir(parents=True)
                document_path.write_text(
                    serialize_source(
                        source(
                            "requirements",
                            active_gate,
                            markdown,
                            requirements,
                        )
                    ),
                    encoding="utf-8",
                )
                goal_document = goal_path
            validate(
                ISSUE,
                issue_path,
                document_path,
                kind,
                repo_root,
                WORKSPACE,
                goal_document,
            )

    def test_accepts_goal_json(self) -> None:
        self.validate_source(kind="goal")

    def test_accepts_artifact_json_matching_goal(self) -> None:
        self.validate_source(kind="artifact")

    def test_display_markdown_cannot_add_requirement_or_section(self) -> None:
        self.validate_source(
            kind="artifact",
            markdown="```json\nFR-999 fake\n```\n<!-- ## 偽セクション -->\n",
        )

    def test_rejects_requirement_content_without_substantive_summary(self) -> None:
        for kind in ("goal", "artifact"):
            for content in (
                "FR-1",
                "FR-1 TODO",
                "FR-1 pending 未定",
                "FR-1 TODOです",
                "FR-1 未定です",
                "FR-1 TBD対応待ち",
            ):
                with self.subTest(kind=kind, content=content):
                    with self.assertRaisesRegex(ValidationError, "substantive summary"):
                        self.validate_source(
                            kind=kind,
                            requirements=[
                                ("FR-1", content),
                                REQUIREMENTS[1],
                            ],
                        )

    def test_rejects_shared_structured_section_evidence(self) -> None:
        gate = deepcopy(completeness_gate())
        gate["sections"][1]["issue_evidence"] = gate["sections"][0]["issue_evidence"]
        with self.assertRaisesRegex(ValidationError, "unique per section"):
            self.validate_source(kind="artifact", gate=gate)

    def test_accepts_unchanged_git_head_json_baseline(self) -> None:
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
            artifact_path = workspace_root / "requirements.json"
            baseline_value = source("requirements", completeness_gate())
            artifact_path.write_text(serialize_source(baseline_value), encoding="utf-8")
            run_git(repo_root, "add", artifact_path.relative_to(repo_root).as_posix())
            run_git(repo_root, "commit", "-qm", "baseline")
            baseline_bytes = artifact_path.read_bytes()

            gate = completeness_gate()
            gate["baseline"] = {
                "source": "git_head",
                "body_sha256": hashlib.sha256(baseline_bytes).hexdigest(),
            }
            gate["requirements"] = [
                {"id": requirement_id, "status": "unchanged", "issue_evidence": None}
                for requirement_id, _ in REQUIREMENTS
            ]
            gate["sections"] = [
                {"id": section_id, "status": "unchanged", "issue_evidence": None}
                for section_id in REQUIRED_REQUIREMENTS_SECTIONS
            ]
            goal_path = repo_root / "goal.json"
            goal_path.write_text(
                serialize_source(source("requirements_goal", gate)),
                encoding="utf-8",
            )
            artifact_path.write_text(
                serialize_source(source("requirements", gate)),
                encoding="utf-8",
            )
            issue_path = repo_root / "issue.md"
            issue_path.write_text(ISSUE_BODY, encoding="utf-8")
            validate(
                ISSUE,
                issue_path,
                artifact_path,
                "artifact",
                repo_root,
                WORKSPACE,
                goal_path,
            )


if __name__ == "__main__":
    unittest.main()
