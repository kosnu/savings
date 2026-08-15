from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

from artifact_source import serialize_source
from validate_requirements_continuity import (
    LEGACY_REQUIRED_REQUIREMENTS_SECTIONS,
    REQUIRED_REQUIREMENTS_SECTIONS,
    ValidationError,
    baseline_item_manifest,
    baseline_section_manifest,
    content_sha256,
    structured_sha256,
    structured_sections,
    validate,
)


ISSUE = "owner/repo#1639"
WORKSPACE = "1639-structured-data"
REQUIREMENTS = [
    ("FR-1", "JSONを検証正本として扱う。", "functional"),
    ("AC-1", "表示Markdownだけの変更は検証結果を変えない。", "acceptance"),
]
SECTION_HEADINGS = {
    "background": "背景",
    "users": "対象ユーザー",
    "stories": "ユーザーストーリー",
    "scope": "スコープ",
    "functional": "機能要件",
    "non-functional": "非機能要件",
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
    [f"{requirement_id} {text}" for requirement_id, text, _ in REQUIREMENTS]
    + list(SECTION_EVIDENCE.values())
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
            {
                "id": requirement_id,
                "status": "new",
                "issue_evidence": f"{requirement_id} {text}",
            }
            for requirement_id, text, _ in REQUIREMENTS
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
    preamble: str = "---\ntitle: display\n---\n\n# display",
    requirements: list[tuple[str, str, str]] | None = None,
    block_overrides: dict[str, list[dict[str, str]]] | None = None,
) -> dict[str, object]:
    active_requirements = requirements or REQUIREMENTS
    validation: dict[str, object] = {
        "mode": "managed",
        "input_gate": {
            "task_context": {
                "source": "issue_body",
                "issue": ISSUE,
                "url": "https://github.com/owner/repo/issues/1639",
                "updated_at": "2026-08-11T00:00:00Z",
                "body_sha256": hashlib.sha256(ISSUE_BODY.encode()).hexdigest(),
            },
            "direct_rules": [
                {
                    "id": "rule",
                    "issue_evidence": "JSON",
                    "match": {"field": "topics", "value": "JSON"},
                    "reason": "continuity test fixture",
                }
            ],
            "depends_on": [],
        },
        "completeness_gate": gate,
        "requirements": [
            (
                {"id": requirement_id, "text": text}
                if kind == "requirements_goal"
                else {"id": requirement_id, "section_id": section_id, "text": text}
            )
            for requirement_id, text, section_id in active_requirements
        ],
    }
    if kind == "requirements":
        validation["sections"] = [
            {
                "id": section_id,
                "heading": SECTION_HEADINGS[section_id],
                "blocks": (block_overrides or {}).get(
                    section_id,
                    [
                        {
                            "id": f"{section_id}-evidence",
                            "type": "markdown",
                            "markdown": SECTION_EVIDENCE[section_id],
                        },
                        *(
                            [
                                {
                                    "id": f"{section_id}-requirements",
                                    "type": "requirements",
                                }
                            ]
                            if any(
                                requirement_section == section_id
                                for _, _, requirement_section in active_requirements
                            )
                            else []
                        ),
                    ],
                ),
            }
            for section_id in REQUIRED_REQUIREMENTS_SECTIONS
        ]
        display = {"path": "requirements.md", "preamble": preamble}
    else:
        display = {
            "path": "goal.md",
            "title": "Requirements Goal",
            "goal": "構造化Requirementsを検証する。",
            "context": {
                "body": ["Issue本文を正本とする。"],
                "constraints": ["Markdownを解析しない。"],
                "stop": ["JSONが不正なら停止する。"],
            },
            "done": ["continuity gateが成功する。"],
        }
    return {
        "schema_version": 2,
        "kind": kind,
        "workspace": WORKSPACE,
        "display": display,
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
        preamble: str = "---\ntitle: display\n---\n\n# display",
        requirements: list[tuple[str, str, str]] | None = None,
        block_overrides: dict[str, list[dict[str, str]]] | None = None,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
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
                            preamble,
                            requirements,
                            block_overrides,
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

    def test_display_preamble_cannot_add_requirement_or_section(self) -> None:
        self.validate_source(
            kind="artifact",
            preamble="# display\n\nFR-999 fake\n\n## 偽セクション",
        )

    def test_rejects_requirement_content_without_substantive_summary(self) -> None:
        for kind in ("goal", "artifact"):
            for text in (
                "FR-1",
                "FR-1 TODO",
                "FR-1 pending 未定",
                "FR-1 TODOです",
                "FR-1 未定です",
                "FR-1 TBD対応待ち",
            ):
                with self.subTest(kind=kind, text=text):
                    with self.assertRaisesRegex(ValidationError, "substantive summary"):
                        self.validate_source(
                            kind=kind,
                            requirements=[
                                ("FR-1", text, "functional"),
                                REQUIREMENTS[1],
                            ],
                        )

    def test_requirement_text_is_not_interpreted_as_markdown(self) -> None:
        self.validate_source(
            kind="artifact",
            requirements=[
                ("FR-1", "<!-- JSONを検証正本として扱う。 -->", "functional"),
                REQUIREMENTS[1],
            ],
        )

    def test_section_blocks_are_not_searched_for_gate_evidence(self) -> None:
        self.validate_source(
            kind="artifact",
            block_overrides={
                "background": [
                    {
                        "id": "background-markdown",
                        "type": "markdown",
                        "markdown": "```text\n表示専用\n```",
                    }
                ]
            },
        )

    def test_validator_has_no_managed_markdown_parser_dependency(self) -> None:
        validator = Path(__file__).with_name(
            "validate_requirements_continuity.py"
        ).read_text(encoding="utf-8")

        self.assertNotIn("structured_ids", validator)
        self.assertNotIn("mask_non_rendered_markdown", validator)
        self.assertNotIn('display["markdown"]', validator)

    def test_content_hash_preserves_whitespace_except_newline_style(self) -> None:
        self.assertEqual(content_sha256("A\r\nB"), content_sha256("A\nB"))
        self.assertNotEqual(content_sha256("A\nB"), content_sha256("A B"))
        self.assertEqual(
            structured_sha256([{"id": "a", "markdown": "A\r\nB"}]),
            structured_sha256([{"markdown": "A\nB", "id": "a"}]),
        )

    def test_legacy_baseline_uses_saved_inventory_not_display_markdown(self) -> None:
        markdown = "# legacy display\n\nFR-999 表示専用\n"
        value = source("requirements", completeness_gate())
        legacy = {
            "schema_version": 1,
            "kind": "requirements",
            "workspace": WORKSPACE,
            "display": {"path": "requirements.md", "markdown": markdown},
            "validation": {
                "mode": "managed",
                "input_gate": value["validation"]["input_gate"],
                "completeness_gate": value["validation"]["completeness_gate"],
                "requirements": [
                    {"id": "FR-1", "content": "inventory FR content"},
                    {"id": "AC-1", "content": "inventory AC content"},
                ],
                "sections": [
                    {
                        "id": section_id,
                        "heading": SECTION_HEADINGS[section_id],
                        "content": f"inventory {section_id} content",
                    }
                    for section_id in LEGACY_REQUIRED_REQUIREMENTS_SECTIONS
                ],
                "source_markdown_sha256": hashlib.sha256(
                    markdown.encode("utf-8")
                ).hexdigest(),
            },
        }
        baseline_bytes = json.dumps(legacy, ensure_ascii=False).encode("utf-8")

        self.assertEqual(
            baseline_item_manifest(baseline_bytes)[0]["content_sha256"],
            content_sha256("inventory FR content"),
        )
        self.assertEqual(
            baseline_section_manifest(baseline_bytes)[0]["content_sha256"],
            content_sha256("inventory background content"),
        )

    def test_rejects_shared_structured_section_evidence(self) -> None:
        gate = deepcopy(completeness_gate())
        gate["sections"][1]["issue_evidence"] = gate["sections"][0]["issue_evidence"]
        with self.assertRaisesRegex(ValidationError, "unique per section"):
            self.validate_source(kind="artifact", gate=gate)

    def test_accepts_unchanged_git_head_json_baseline(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
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
                for requirement_id, _, _ in REQUIREMENTS
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

    def test_goal_rejects_requirement_status_that_disagrees_with_git_head(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
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
            artifact_path.write_text(
                serialize_source(source("requirements", completeness_gate())),
                encoding="utf-8",
            )
            run_git(repo_root, "add", artifact_path.relative_to(repo_root).as_posix())
            run_git(repo_root, "commit", "-qm", "baseline")
            baseline_bytes = artifact_path.read_bytes()
            issue_path = repo_root / "issue.md"
            issue_path.write_text(ISSUE_BODY, encoding="utf-8")
            goal_path = repo_root / "goal.json"

            for status, requirements, expected_error in (
                (
                    "unchanged",
                    [
                        ("FR-1", "JSON正本の内容を変更する。", "functional"),
                        REQUIREMENTS[1],
                    ],
                    "unchanged requirement content changed",
                ),
                (
                    "changed",
                    REQUIREMENTS,
                    "changed requirement content is identical",
                ),
            ):
                with self.subTest(status=status):
                    gate = completeness_gate()
                    gate["baseline"] = {
                        "source": "git_head",
                        "body_sha256": hashlib.sha256(baseline_bytes).hexdigest(),
                    }
                    gate["requirements"] = [
                        {
                            "id": requirement_id,
                            "status": status if requirement_id == "FR-1" else "unchanged",
                            "issue_evidence": (
                                REQUIREMENTS[0][1]
                                if requirement_id == "FR-1" and status == "changed"
                                else None
                            ),
                        }
                        for requirement_id, _, _ in REQUIREMENTS
                    ]
                    gate["sections"] = [
                        {
                            "id": section_id,
                            "status": "unchanged",
                            "issue_evidence": None,
                        }
                        for section_id in REQUIRED_REQUIREMENTS_SECTIONS
                    ]
                    goal_path.write_text(
                        serialize_source(
                            source(
                                "requirements_goal",
                                gate,
                                requirements=requirements,
                            )
                        ),
                        encoding="utf-8",
                    )

                    with self.assertRaisesRegex(ValidationError, expected_error):
                        validate(
                            ISSUE,
                            issue_path,
                            goal_path,
                            "goal",
                            repo_root,
                            WORKSPACE,
                        )

    def test_artifact_rejects_section_status_that_disagrees_with_blocks(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            workspace_root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            workspace_root.mkdir(parents=True)
            artifact_path = workspace_root / "requirements.json"
            artifact_path.write_text(
                serialize_source(source("requirements", completeness_gate())),
                encoding="utf-8",
            )
            run_git(repo_root, "add", artifact_path.relative_to(repo_root).as_posix())
            run_git(repo_root, "commit", "-qm", "baseline")
            baseline_bytes = artifact_path.read_bytes()
            issue_path = repo_root / "issue.md"
            issue_path.write_text(ISSUE_BODY, encoding="utf-8")
            goal_path = repo_root / "goal.json"

            for status, block_overrides, expected_error in (
                (
                    "unchanged",
                    {
                        "background": [
                            {
                                "id": "background-evidence",
                                "type": "markdown",
                                "markdown": "変更後のblock",
                            }
                        ]
                    },
                    "unchanged Requirements section changed",
                ),
                (
                    "changed",
                    None,
                    "changed Requirements section is identical",
                ),
            ):
                with self.subTest(status=status):
                    gate = completeness_gate()
                    gate["baseline"] = {
                        "source": "git_head",
                        "body_sha256": hashlib.sha256(baseline_bytes).hexdigest(),
                    }
                    gate["requirements"] = [
                        {
                            "id": requirement_id,
                            "status": "unchanged",
                            "issue_evidence": None,
                        }
                        for requirement_id, _, _ in REQUIREMENTS
                    ]
                    gate["sections"] = [
                        {
                            "id": section_id,
                            "status": status if section_id == "background" else "unchanged",
                            "issue_evidence": (
                                SECTION_EVIDENCE["background"]
                                if section_id == "background" and status == "changed"
                                else None
                            ),
                        }
                        for section_id in REQUIRED_REQUIREMENTS_SECTIONS
                    ]
                    goal_path.write_text(
                        serialize_source(source("requirements_goal", gate)),
                        encoding="utf-8",
                    )
                    artifact_path.write_text(
                        serialize_source(
                            source(
                                "requirements",
                                gate,
                                block_overrides=block_overrides,
                            )
                        ),
                        encoding="utf-8",
                    )

                    with self.assertRaisesRegex(ValidationError, expected_error):
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
