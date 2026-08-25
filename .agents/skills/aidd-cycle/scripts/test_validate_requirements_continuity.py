from __future__ import annotations

import hashlib
import subprocess
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

from artifact_source import serialize_source, structured_sha256
from git_baseline import canonical_workspace_name
from validate_requirements_continuity import (
    REQUIRED_REQUIREMENTS_SECTIONS,
    ValidationError,
    baseline_item_manifest,
    baseline_section_manifest,
    content_sha256,
    section_content_hash,
    structured_requirements,
    structured_sections,
    validate,
    validate_retired,
)


ISSUE = "owner/repo#1639"
ISSUE_TITLE = "Structured Data"
WORKSPACE = canonical_workspace_name(ISSUE, ISSUE_TITLE)
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
                "issue_evidence": text,
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
    heading_overrides: dict[str, str] | None = None,
) -> dict[str, object]:
    active_requirements = requirements or REQUIREMENTS
    validation: dict[str, object] = {
        "mode": "managed",
        "cycle_start_issue_title": ISSUE_TITLE,
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
                "heading": (heading_overrides or {}).get(
                    section_id, SECTION_HEADINGS[section_id]
                ),
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
        "schema_version": 3,
        "kind": kind,
        "workspace": WORKSPACE,
        "display": display,
        "validation": validation,
    }


class RequirementsContinuityGateTest(unittest.TestCase):
    def test_rejects_section_heading_for_another_section_id(self) -> None:
        value = source("requirements", completeness_gate())
        value["validation"]["sections"][4]["heading"] = "非機能要件"

        with self.assertRaisesRegex(ValidationError, "exactly one canonical section"):
            structured_sections(value)

    def test_section_hash_includes_owned_requirement_text(self) -> None:
        baseline = source("requirements", completeness_gate())
        changed = deepcopy(baseline)
        changed["validation"]["requirements"][0]["text"] = (
            "FR-1 JSONを検証正本として扱う。追加の要件。"
        )

        baseline_items = structured_requirements(baseline)
        changed_items = structured_requirements(changed)
        baseline_sections = structured_sections(baseline)
        changed_sections = structured_sections(changed)

        self.assertNotEqual(
            section_content_hash(
                "functional",
                baseline_sections["functional"],
                baseline_items,
            ),
            section_content_hash(
                "functional",
                changed_sections["functional"],
                changed_items,
            ),
        )

    def test_section_hash_includes_heading(self) -> None:
        baseline = source("requirements", completeness_gate())
        changed = deepcopy(baseline)
        changed["validation"]["sections"][4]["heading"] = (
            "Functional Requirements"
        )

        baseline_items = structured_requirements(baseline)
        changed_items = structured_requirements(changed)
        baseline_sections = structured_sections(baseline)
        changed_sections = structured_sections(changed)

        self.assertNotEqual(
            section_content_hash(
                "functional",
                baseline_sections["functional"],
                baseline_items,
            ),
            section_content_hash(
                "functional",
                changed_sections["functional"],
                changed_items,
            ),
        )

    def test_rejects_unapproved_section_heading_suffix(self) -> None:
        value = source("requirements", completeness_gate())
        value["validation"]["sections"][4]["heading"] = "機能要件と追加説明"

        with self.assertRaisesRegex(ValidationError, "exactly one canonical section"):
            structured_sections(value)

    def validate_source(
        self,
        *,
        kind: str,
        gate: dict[str, object] | None = None,
        preamble: str = "---\ntitle: display\n---\n\n# display",
        requirements: list[tuple[str, str, str]] | None = None,
        block_overrides: dict[str, list[dict[str, str]]] | None = None,
        heading_overrides: dict[str, str] | None = None,
        issue_title: str = ISSUE_TITLE,
    ) -> None:
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
                document_path = workspace_root / "requirements.json"
                document_path.write_text(
                    serialize_source(
                        source(
                            "requirements",
                            active_gate,
                            preamble,
                            requirements,
                            block_overrides,
                            heading_overrides,
                        )
                    ),
                    encoding="utf-8",
                )
                goal_document = goal_path
            validate(
                ISSUE,
                issue_title,
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

    def test_rejects_trim_equivalent_fetched_issue_title(self) -> None:
        with self.assertRaisesRegex(ValidationError, "fetched Issue title"):
            self.validate_source(
                kind="goal",
                issue_title=f" {ISSUE_TITLE} ",
            )

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
                (
                    "FR-1",
                    "JSONを検証正本として扱う。 <!-- 表示専用 -->",
                    "functional",
                ),
                REQUIREMENTS[1],
            ],
        )

    def test_section_block_evidence_is_not_interpreted_as_markdown(self) -> None:
        self.validate_source(
            kind="artifact",
            block_overrides={
                "background": [
                    {
                        "id": "background-markdown",
                        "type": "markdown",
                        "markdown": (
                            f"```text\n{SECTION_EVIDENCE['background']}\n```"
                        ),
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

    def test_rejects_retirement_term_inside_dropdown(self) -> None:
        with self.assertRaisesRegex(
            ValidationError, "retired evidence must explicitly state retirement"
        ):
            validate_retired(
                [
                    {
                        "id": "FR-1",
                        "issue_evidence": "FR-1 dropdown navigation",
                    }
                ],
                {"FR-1"},
                "FR-1 dropdown navigation",
            )

    def test_accepts_standalone_english_retirement_term(self) -> None:
        self.assertEqual(
            validate_retired(
                [
                    {
                        "id": "FR-1",
                        "issue_evidence": "FR-1 drop this requirement",
                    }
                ],
                {"FR-1"},
                "FR-1 drop this requirement",
            ),
            {"FR-1"},
        )

    def test_content_hash_preserves_whitespace_except_newline_style(self) -> None:
        self.assertEqual(content_sha256("A\r\nB"), content_sha256("A\nB"))
        self.assertNotEqual(content_sha256("A\nB"), content_sha256("A B"))
        self.assertEqual(
            structured_sha256([{"id": "a", "markdown": "A\r\nB"}]),
            structured_sha256([{"markdown": "A\nB", "id": "a"}]),
        )

    def test_managed_baseline_uses_structured_fields_not_display_preamble(self) -> None:
        value = source("requirements", completeness_gate())
        value["display"]["preamble"] = "# display\n\nFR-999 表示専用\n"
        baseline_bytes = serialize_source(value).encode("utf-8")
        items = structured_requirements(value)
        sections = structured_sections(value)

        self.assertEqual(
            baseline_item_manifest(baseline_bytes)[0]["content_sha256"],
            content_sha256(items["FR-1"].text),
        )
        self.assertEqual(
            baseline_section_manifest(baseline_bytes)[0]["content_sha256"],
            section_content_hash("background", sections["background"], items),
        )

    def test_rejects_shared_structured_section_evidence(self) -> None:
        gate = deepcopy(completeness_gate())
        gate["sections"][1]["issue_evidence"] = gate["sections"][0]["issue_evidence"]
        with self.assertRaisesRegex(ValidationError, "unique per section"):
            self.validate_source(kind="artifact", gate=gate)

    def test_rejects_issue_evidence_unrelated_to_section_content(self) -> None:
        with self.assertRaisesRegex(
            ValidationError, "not present in its section content"
        ):
            self.validate_source(
                kind="artifact",
                block_overrides={
                    "background": [
                        {
                            "id": "background-unrelated",
                            "type": "markdown",
                            "markdown": "Issue根拠とは無関係な本文",
                        }
                    ]
                },
            )

    def test_rejects_section_evidence_mapped_to_another_section(self) -> None:
        with self.assertRaisesRegex(ValidationError, "also maps to another section"):
            self.validate_source(
                kind="artifact",
                block_overrides={
                    "users": [
                        {
                            "id": "users-evidence",
                            "type": "markdown",
                            "markdown": (
                                f"{SECTION_EVIDENCE['users']}\n"
                                f"{SECTION_EVIDENCE['background']}"
                            ),
                        }
                    ]
                },
            )

    def test_accepts_section_evidence_from_assigned_requirement(self) -> None:
        gate = deepcopy(completeness_gate())
        gate["sections"][4]["issue_evidence"] = REQUIREMENTS[0][1]
        self.validate_source(
            kind="artifact",
            gate=gate,
            block_overrides={
                "functional": [
                    {
                        "id": "functional-requirements",
                        "type": "requirements",
                    }
                ]
            },
        )

    def test_rejects_issue_evidence_unrelated_to_requirement_text(self) -> None:
        requirements = [
            ("FR-1", "FR-1 削除できるようにする。", "functional"),
            REQUIREMENTS[1],
        ]
        for kind in ("goal", "artifact"):
            with self.subTest(kind=kind):
                with self.assertRaisesRegex(
                    ValidationError, "not present in its requirement text"
                ):
                    self.validate_source(kind=kind, requirements=requirements)

    def test_rejects_issue_evidence_mapped_to_another_requirement(self) -> None:
        requirements = [
            REQUIREMENTS[0],
            (
                "AC-1",
                "AC-1 表示Markdownだけの変更は検証結果を変えない。"
                " JSONを検証正本として扱う。",
                "acceptance",
            ),
        ]
        for kind in ("goal", "artifact"):
            with self.subTest(kind=kind):
                with self.assertRaisesRegex(
                    ValidationError, "also maps to another requirement"
                ):
                    self.validate_source(kind=kind, requirements=requirements)

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
                ISSUE_TITLE,
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
                            ISSUE_TITLE,
                            issue_path,
                            goal_path,
                            "goal",
                            repo_root,
                            WORKSPACE,
                        )

    def test_artifact_rejects_section_status_that_disagrees_with_content(self) -> None:
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

            for status, block_overrides, heading_overrides, expected_error in (
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
                    None,
                    "unchanged Requirements section changed",
                ),
                (
                    "changed",
                    None,
                    None,
                    "changed Requirements section is identical",
                ),
                (
                    "unchanged",
                    None,
                    {"functional": "Functional Requirements"},
                    "unchanged Requirements section changed",
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
                                heading_overrides=heading_overrides,
                            )
                        ),
                        encoding="utf-8",
                    )

                    with self.assertRaisesRegex(ValidationError, expected_error):
                        validate(
                            ISSUE,
                            ISSUE_TITLE,
                            issue_path,
                            artifact_path,
                            "artifact",
                            repo_root,
                            WORKSPACE,
                            goal_path,
                        )


if __name__ == "__main__":
    unittest.main()
