from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from artifact_source import SourceError, load_source, serialize_source, validate_source
from render_aidd_artifact import check_all, check_or_write, render_goal_objective


WORKSPACE = "1639-structured-data"


def initialize_repository(repo_root: Path) -> None:
    subprocess.run(
        ["git", "init", "--quiet"],
        cwd=repo_root,
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "config", "user.name", "AIDD Test"],
        cwd=repo_root,
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "config", "user.email", "aidd@example.com"],
        cwd=repo_root,
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "commit", "--allow-empty", "--quiet", "-m", "baseline"],
        cwd=repo_root,
        check=True,
        capture_output=True,
    )


def source() -> dict[str, object]:
    return {
        "schema_version": 1,
        "kind": "requirements",
        "workspace": WORKSPACE,
        "display": {"path": "requirements.md", "markdown": "# Requirements\n"},
        "validation": {"mode": "managed"},
    }


def goal_source(kind: str) -> dict[str, object]:
    if kind == "requirements_goal":
        input_gate = {"task_context": {"issue": "owner/repo#1639"}}
        completeness_gate = {"workspace": WORKSPACE}
        requirements = [{"id": "FR-1", "content": "- FR-1: 全体scopeを扱う。"}]
        validation = {
            "mode": "managed",
            "input_gate": input_gate,
            "completeness_gate": completeness_gate,
            "requirements": requirements,
        }
        structured_sections = (
            "## Requirements Input Gate\n```json\n"
            f"{json.dumps(input_gate, ensure_ascii=False)}\n```\n\n"
            "## Requirements Completeness Gate\n```json\n"
            f"{json.dumps(completeness_gate, ensure_ascii=False)}\n```\n\n"
            "## Requirement Scope\n- FR-1: 全体scopeを扱う。\n"
        )
    else:
        coverage_gate = {"workspace": WORKSPACE, "requirement_ids": ["FR-1"]}
        scopes = [
            {
                "id": "FR-1",
                "design_scope": "FR-1 design scope: 全体を設計する。",
                "verification_scope": "FR-1 verification scope: 全体を検証する。",
            }
        ]
        validation = {
            "mode": "managed",
            "coverage_gate": coverage_gate,
            "scopes": scopes,
            "baseline_scopes": [],
        }
        structured_sections = (
            "## Design Coverage Gate\n```json\n"
            f"{json.dumps(coverage_gate, ensure_ascii=False)}\n```\n\n"
            "## Requirement Design Scope\n"
            "- FR-1 design scope: 全体を設計する。\n"
            "- FR-1 verification scope: 全体を検証する。\n"
        )
    markdown = (
        "# Goal\n\n## Goal\n全体を扱う。\n\n## Context Packet\n"
        "- Constraints: 正本境界を守る。\n"
        "- Stop: scopeが変わる場合。\n\n"
        f"{structured_sections}\n## Done / Verification\n全体を確認する。\n"
    )
    return {
        "schema_version": 1,
        "kind": kind,
        "workspace": WORKSPACE,
        "display": {"path": "goal.md", "markdown": markdown},
        "validation": validation,
    }


class ArtifactSourceTest(unittest.TestCase):
    def test_goal_objective_matches_structured_source(self) -> None:
        for kind in ("requirements_goal", "design_goal"):
            with self.subTest(kind=kind):
                value = goal_source(kind)
                objective = render_goal_objective(value)
                self.assertIn("- Validated Scope: FR-1。", objective)
                self.assertIn("## Context Packet", objective)

    def test_goal_objective_rejects_empty_or_narrow_display(self) -> None:
        for kind in ("requirements_goal", "design_goal"):
            for markdown in ("", "# Goal\n\n今回の差分だけを扱う。\n"):
                with self.subTest(kind=kind, markdown=markdown):
                    value = goal_source(kind)
                    value["display"]["markdown"] = markdown
                    with self.assertRaisesRegex(SourceError, "required marker"):
                        render_goal_objective(value)

    def test_goal_objective_rejects_missing_structured_scope(self) -> None:
        for kind in ("requirements_goal", "design_goal"):
            with self.subTest(kind=kind):
                value = goal_source(kind)
                if kind == "requirements_goal":
                    missing = value["validation"]["requirements"][0]["content"]
                else:
                    missing = value["validation"]["scopes"][0]["verification_scope"]
                value["display"]["markdown"] = value["display"]["markdown"].replace(
                    missing, ""
                )
                with self.assertRaisesRegex(SourceError, "structured scope"):
                    render_goal_objective(value)

    def test_goal_objective_rejects_delta_only_goal_summary(self) -> None:
        value = goal_source("design_goal")
        value["display"]["markdown"] = value["display"]["markdown"].replace(
            "全体を扱う。", "今回の差分だけを扱う。"
        )
        with self.assertRaisesRegex(SourceError, "must not narrow scope"):
            render_goal_objective(value)

        value = goal_source("design_goal")
        value["display"]["markdown"] += "\n## Goal\n今回の差分だけを扱う。\n"
        with self.assertRaisesRegex(SourceError, "exactly one ## Goal"):
            render_goal_objective(value)

        value = goal_source("design_goal")
        value["display"]["markdown"] = value["display"]["markdown"].replace(
            "- Constraints: 正本境界を守る。",
            "- Constraints: 今回の差分だけを扱う。",
        )
        with self.assertRaisesRegex(SourceError, "must not narrow scope"):
            render_goal_objective(value)

    def test_goal_objective_accepts_multiline_requirement_content(self) -> None:
        value = goal_source("requirements_goal")
        content = "- FR-1: 全体scopeを扱う。\n  - 詳細条件も保持する。"
        value["validation"]["requirements"][0]["content"] = content
        value["display"]["markdown"] = value["display"]["markdown"].replace(
            "- FR-1: 全体scopeを扱う。", content
        )

        self.assertIn("- Validated Scope: FR-1。", render_goal_objective(value))

    def test_goal_objective_rejects_hidden_markers_and_scope(self) -> None:
        value = goal_source("design_goal")
        scope = value["validation"]["scopes"][0]["verification_scope"]
        value["display"]["markdown"] = (
            "<!--\n## Goal\n## Context Packet\n- Constraints: hidden\n"
            "- Stop: hidden\n## Done / Verification\n-->\n"
            f"```text\n- {scope}\n```\n"
            "## Design Coverage Gate\n```json\n"
            f"{json.dumps(value['validation']['coverage_gate'])}\n```\n"
        )
        with self.assertRaisesRegex(SourceError, "required marker"):
            render_goal_objective(value)

        value = goal_source("design_goal")
        value["display"]["markdown"] = (
            "~~~markdown\n" + value["display"]["markdown"] + "~~~\n"
        )
        with self.assertRaisesRegex(SourceError, "required marker"):
            render_goal_objective(value)

        value = goal_source("design_goal")
        value["display"]["markdown"] = "".join(
            f"    {line}" for line in value["display"]["markdown"].splitlines(True)
        )
        with self.assertRaisesRegex(SourceError, "required marker"):
            render_goal_objective(value)

        value = goal_source("design_goal")
        value["display"]["markdown"] = value["display"]["markdown"].replace(
            f"- {scope}\n", f"```text\n- {scope}\n```\n"
        )
        with self.assertRaisesRegex(SourceError, "structured scope"):
            render_goal_objective(value)

    def test_goal_objective_rejects_gate_inside_outer_fence(self) -> None:
        value = goal_source("design_goal")
        gate = value["validation"]["coverage_gate"]
        gate_block = (
            "## Design Coverage Gate\n```json\n"
            f"{json.dumps(gate, ensure_ascii=False)}\n```"
        )
        value["display"]["markdown"] = value["display"]["markdown"].replace(
            gate_block, f"~~~markdown\n{gate_block}\n~~~"
        )

        with self.assertRaisesRegex(SourceError, "missing Design Coverage Gate"):
            render_goal_objective(value)

        value = goal_source("design_goal")
        value["display"]["markdown"] = value["display"]["markdown"].replace(
            "## Design Coverage Gate\n```json",
            "## Design Coverage Gate\n    ```json",
        )
        with self.assertRaisesRegex(SourceError, "missing"):
            render_goal_objective(value)

    def test_rejects_unknown_envelope_key(self) -> None:
        value = source()
        value["unexpected"] = True
        with self.assertRaisesRegex(SourceError, "must contain only"):
            validate_source(value)

    def test_rejects_display_path_for_other_kind(self) -> None:
        value = source()
        value["display"]["path"] = "design-doc.md"
        with self.assertRaisesRegex(SourceError, "display.path"):
            validate_source(value)

    def test_rejects_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "requirements.json"
            path.write_text("{invalid", encoding="utf-8")
            with self.assertRaisesRegex(SourceError, "JSON is invalid"):
                load_source(path)

    def test_renderer_detects_stale_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            root.mkdir(parents=True)
            source_path = root / "requirements.json"
            output_path = root / "requirements.md"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            output_path.write_text("# stale\n", encoding="utf-8")
            with self.assertRaisesRegex(SourceError, "stale"):
                check_or_write(source_path, output_path, True, repo_root)

    def test_renderer_accepts_crlf_for_lf_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            root.mkdir(parents=True)
            source_path = root / "requirements.json"
            output_path = root / "requirements.md"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            output_path.write_bytes(b"# Requirements\r\n")

            check_or_write(source_path, output_path, True, repo_root)

    def test_renderer_accepts_lf_for_crlf_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            root.mkdir(parents=True)
            source_value = source()
            source_value["display"]["markdown"] = "# Requirements\r\n"
            source_path = root / "requirements.json"
            output_path = root / "requirements.md"
            source_path.write_text(serialize_source(source_value), encoding="utf-8")
            output_path.write_bytes(b"# Requirements\n")

            check_or_write(source_path, output_path, True, repo_root)

    def test_renderer_rejects_lone_cr_as_lf(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            root.mkdir(parents=True)
            source_path = root / "requirements.json"
            output_path = root / "requirements.md"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            output_path.write_bytes(b"# Requirements\r")

            with self.assertRaisesRegex(SourceError, "stale"):
                check_or_write(source_path, output_path, True, repo_root)

    def test_renderer_rejects_non_git_repo_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            root.mkdir(parents=True)
            source_path = root / "requirements.json"
            output_path = root / "requirements.md"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            output_path.write_text("# Requirements\n", encoding="utf-8")

            with self.assertRaisesRegex(SourceError, "not a readable Git worktree"):
                check_or_write(source_path, output_path, True, repo_root)

    def test_renderer_rejects_symlinked_repo_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            temporary_root = Path(directory).resolve()
            repo_root = temporary_root / "repo"
            repo_root.mkdir()
            initialize_repository(repo_root)
            symlink_root = temporary_root / "repo-alias"
            symlink_root.symlink_to(repo_root, target_is_directory=True)
            root = (
                symlink_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            root.mkdir(parents=True)
            source_path = root / "requirements.json"
            output_path = root / "requirements.md"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            output_path.write_text("# Requirements\n", encoding="utf-8")

            with self.assertRaisesRegex(SourceError, "must not contain symlinks"):
                check_or_write(source_path, output_path, True, symlink_root)

    def test_renderer_rejects_noncanonical_artifact_output(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            workspace_root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            workspace_root.mkdir(parents=True)
            source_path = workspace_root / "requirements.json"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            with self.assertRaisesRegex(SourceError, "output must be canonical"):
                check_or_write(
                    source_path,
                    repo_root / "temporary.md",
                    True,
                    repo_root,
                )

    def test_renderer_rejects_noncanonical_artifact_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            source_path = repo_root / "temporary.json"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            with self.assertRaisesRegex(SourceError, "source must be canonical"):
                check_or_write(
                    source_path,
                    repo_root
                    / "docs"
                    / "ai-driven-development"
                    / "workspaces"
                    / WORKSPACE
                    / "requirements.md",
                    True,
                    repo_root,
                )

    def test_renderer_requires_repo_root_for_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source_path = root / "requirements.json"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            with self.assertRaisesRegex(SourceError, "requires --repo-root"):
                check_or_write(source_path, root / "requirements.md", True)

    def test_check_all_rejects_kind_filename_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            workspace_root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            workspace_root.mkdir(parents=True)
            wrong_path = workspace_root / "design.json"
            wrong_path.write_text(serialize_source(source()), encoding="utf-8")
            (workspace_root / "requirements.md").write_text(
                "# Requirements\n", encoding="utf-8"
            )
            with self.assertRaisesRegex(SourceError, "requirements.json"):
                check_all(repo_root)

    def test_check_all_rejects_missing_artifact_source(self) -> None:
        for display_filename in ("requirements.md", "design-doc.md"):
            with self.subTest(display_filename=display_filename):
                with tempfile.TemporaryDirectory() as directory:
                    repo_root = Path(directory).resolve()
                    initialize_repository(repo_root)
                    workspace_root = (
                        repo_root
                        / "docs"
                        / "ai-driven-development"
                        / "workspaces"
                        / WORKSPACE
                    )
                    workspace_root.mkdir(parents=True)
                    (workspace_root / display_filename).write_text(
                        "# Artifact\n", encoding="utf-8"
                    )

                    with self.assertRaisesRegex(SourceError, "source is missing"):
                        check_all(repo_root)

    def test_check_all_rejects_artifact_pair_deleted_from_worktree(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repository(repo_root)
            workspace_root = (
                repo_root
                / "docs"
                / "ai-driven-development"
                / "workspaces"
                / WORKSPACE
            )
            workspace_root.mkdir(parents=True)
            source_path = workspace_root / "requirements.json"
            output_path = workspace_root / "requirements.md"
            source_path.write_text(serialize_source(source()), encoding="utf-8")
            output_path.write_text("# Requirements\n", encoding="utf-8")
            subprocess.run(
                ["git", "add", "docs"],
                cwd=repo_root,
                check=True,
                capture_output=True,
            )
            subprocess.run(
                ["git", "commit", "--quiet", "-m", "tracked pair"],
                cwd=repo_root,
                check=True,
                capture_output=True,
            )
            source_path.unlink()
            output_path.unlink()

            with self.assertRaisesRegex(SourceError, "source is missing"):
                check_all(repo_root)


if __name__ == "__main__":
    unittest.main()
