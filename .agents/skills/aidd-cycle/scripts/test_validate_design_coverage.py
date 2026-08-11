from __future__ import annotations

import hashlib
import subprocess
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

from artifact_source import serialize_source
from validate_design_coverage import ValidationError, content_sha256, validate


ISSUE = "owner/repo#1639"
WORKSPACE = "1639-structured-data"
REQUIREMENTS = [
    {"id": "FR-1", "content": "JSONを検証正本として扱う。"},
    {"id": "AC-1", "content": "表示Markdownは検証入力にしない。"},
]
IDS = [entry["id"] for entry in REQUIREMENTS]


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


def scopes() -> list[dict[str, str]]:
    return [
        {
            "id": requirement_id,
            "design_scope": f"{requirement_id} の構造化設計境界を定義する。",
            "verification_scope": f"{requirement_id} の構造化検証を個別に確認する。",
        }
        for requirement_id in IDS
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
    return [
        {"heading": "構造化設計", "content": "JSON正本と表示生成の境界を定義する。"},
        {"heading": "検証方針", "content": "構造化フィールドだけを検証入力にする。"},
    ]


class DesignCoverageGateTest(unittest.TestCase):
    def validate_source(
        self,
        *,
        kind: str,
        goal_scopes: list[dict[str, str]] | None = None,
        markdown: str = "# display\n",
        canonical_requirements: bool = True,
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
            requirements_source = envelope(
                "requirements",
                {"requirements": REQUIREMENTS},
            )
            requirements_path = (
                workspace_root / "requirements.json"
                if canonical_requirements
                else repo_root / "requirements.json"
            )
            requirements_path.write_text(
                serialize_source(requirements_source),
                encoding="utf-8",
            )
            requirements_hash = hashlib.sha256(requirements_path.read_bytes()).hexdigest()
            common_gate = {
                "requirements_sha256": requirements_hash,
                "workspace": WORKSPACE,
                "requirement_ids": IDS,
                "baseline": {"source": "none", "body_sha256": None},
            }
            if kind == "goal":
                document_path = repo_root / "goal.json"
                value = envelope(
                    "design_goal",
                    {"coverage_gate": common_gate, "scopes": goal_scopes or scopes()},
                    markdown,
                )
            else:
                document_path = workspace_root / "design.json"
                value = envelope(
                    "design",
                    {
                        "sections": sections(),
                        "coverage_gate": {
                            **common_gate,
                            "coverage": coverage(),
                            "baseline_sections": [],
                        },
                    },
                    markdown,
                )
            document_path.write_text(serialize_source(value), encoding="utf-8")
            validate(
                ISSUE,
                requirements_path,
                document_path,
                kind,
                repo_root,
                WORKSPACE,
            )

    def test_accepts_goal_json(self) -> None:
        self.validate_source(kind="goal")

    def test_accepts_artifact_json(self) -> None:
        self.validate_source(kind="artifact")

    def test_display_markdown_cannot_supply_coverage(self) -> None:
        self.validate_source(
            kind="artifact",
            markdown="```json\nFR-999 fake coverage\n```\n",
        )

    def test_rejects_scope_that_groups_requirement_ids(self) -> None:
        grouped = deepcopy(scopes())
        grouped[0]["design_scope"] += " AC-1も同時に扱う。"
        with self.assertRaisesRegex(ValidationError, "must name only FR-1"):
            self.validate_source(kind="goal", goal_scopes=grouped)

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
            requirements_path.write_text(
                serialize_source(envelope("requirements", {"requirements": REQUIREMENTS})),
                encoding="utf-8",
            )
            design_path = workspace_root / "design.json"
            baseline_source = envelope("design", {"sections": sections()})
            design_path.write_text(serialize_source(baseline_source), encoding="utf-8")
            run_git(repo_root, "add", "docs")
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
                        "design_evidence": f"{entry['heading']}を維持する。",
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
                requirements_path,
                design_path,
                "artifact",
                repo_root,
                WORKSPACE,
            )


if __name__ == "__main__":
    unittest.main()
