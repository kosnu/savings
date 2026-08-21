from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import validate_build_entry
from artifact_source import serialize_source
from render_aidd_artifact import render_artifact_markdown
from test_validate_design_coverage import (
    ISSUE,
    ISSUE_BODY,
    ISSUE_TITLE,
    ISSUE_UPDATED_AT,
    ISSUE_URL,
    WORKSPACE,
    design_goal_source,
    design_source,
    requirements_source,
    write_rule_map,
)
from validate_design_coverage import ValidationError as DesignValidationError
from validate_build_entry import (
    ValidationError,
    canonical_receipt_path,
    validate_or_capture,
)


CAPTURE_PATH = Path(__file__).with_name("capture_design_completion.py")
BUILD_ENTRY_PATH = Path(__file__).with_name("validate_build_entry.py")


def run_git(repo_root: Path, *arguments: str) -> None:
    subprocess.run(
        ["git", "-C", str(repo_root), *arguments],
        check=True,
        capture_output=True,
    )


def initialize_repo(repo_root: Path) -> tuple[Path, Path]:
    run_git(repo_root, "init", "-q")
    run_git(repo_root, "config", "user.name", "AIDD Test")
    run_git(repo_root, "config", "user.email", "aidd@example.com")
    run_git(repo_root, "commit", "--allow-empty", "-qm", "baseline")
    workspace_root = (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / WORKSPACE
    )
    workspace_root.mkdir(parents=True)
    (workspace_root / ".gitkeep").write_text("", encoding="utf-8")
    run_git(
        repo_root,
        "add",
        str((workspace_root / ".gitkeep").relative_to(repo_root)),
    )
    run_git(repo_root, "commit", "-qm", "establish workspace")
    requirements = requirements_source()
    requirements_path = workspace_root / "requirements.json"
    requirements_path.write_text(serialize_source(requirements), encoding="utf-8")
    (workspace_root / "requirements.md").write_text(
        render_artifact_markdown(requirements), encoding="utf-8"
    )
    requirements_digest = hashlib.sha256(requirements_path.read_bytes()).hexdigest()
    design = design_source(requirements_digest)
    (workspace_root / "design-doc.json").write_text(
        serialize_source(design), encoding="utf-8"
    )
    (workspace_root / "design-doc.md").write_text(
        render_artifact_markdown(design), encoding="utf-8"
    )
    issue_body_path = repo_root / "issue-body.md"
    issue_body_path.write_text(ISSUE_BODY, encoding="utf-8")
    rule_map_path = write_rule_map(repo_root)
    return issue_body_path, rule_map_path


def write_design_goal(repo_root: Path) -> Path:
    requirements_path = (
        repo_root
        / "docs"
        / "ai-driven-development"
        / "workspaces"
        / WORKSPACE
        / "requirements.json"
    )
    goal_path = repo_root / "design-goal.json"
    goal_path.write_text(
        serialize_source(
            design_goal_source(hashlib.sha256(requirements_path.read_bytes()).hexdigest())
        ),
        encoding="utf-8",
    )
    return goal_path


class BuildEntryGateTest(unittest.TestCase):
    def run_gate(
        self,
        repo_root: Path,
        *,
        capture: bool,
        expected_receipt_sha256: str | None = None,
    ) -> tuple[Path, str]:
        issue_body_path = repo_root / "issue-body.md"
        rule_map_path = repo_root / "docs" / "harness" / "rule-map.json"
        goal_document_path: Path | None = None
        if capture:
            goal_document_path = write_design_goal(repo_root)
        return validate_or_capture(
            ISSUE,
            ISSUE_URL,
            ISSUE_UPDATED_AT,
            issue_body_path,
            rule_map_path,
            repo_root,
            WORKSPACE,
            capture=capture,
            goal_document_path=goal_document_path,
            expected_receipt_sha256=expected_receipt_sha256,
        )

    def test_capture_uses_the_canonical_receipt_path(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)

            receipt_path, receipt_sha256 = self.run_gate(repo_root, capture=True)
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))

            self.assertEqual(
                receipt_path,
                canonical_receipt_path(repo_root, WORKSPACE),
            )
            self.assertEqual(receipt["kind"], "design_completion")
            self.assertEqual(receipt["workspace"], WORKSPACE)
            self.assertEqual(receipt["issue"]["title"], ISSUE_TITLE)
            self.assertEqual(len(receipt["design_goal_sha256"]), 64)
            self.assertEqual(
                receipt["selected_rules"][0]["path"],
                "docs/ai-driven-development/workflow.md",
            )
            self.assertEqual(len(receipt_sha256), 64)

    def test_capture_and_build_entry_run_the_real_cli_handoff(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            issue_body_path, rule_map_path = initialize_repo(repo_root)
            goal_path = write_design_goal(repo_root)
            common = [
                "--issue",
                ISSUE,
                "--issue-url",
                ISSUE_URL,
                "--issue-updated-at",
                ISSUE_UPDATED_AT,
                "--issue-body",
                str(issue_body_path),
                "--rule-map",
                str(rule_map_path),
                "--repo-root",
                str(repo_root),
                "--workspace",
                WORKSPACE,
            ]
            capture = subprocess.run(
                [
                    sys.executable,
                    str(CAPTURE_PATH),
                    *common,
                    "--goal-document",
                    str(goal_path),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(capture.returncode, 0, capture.stderr)
            receipt_sha256 = capture.stdout.strip().rsplit("sha256=", 1)[1]
            build = subprocess.run(
                [
                    sys.executable,
                    str(BUILD_ENTRY_PATH),
                    *common,
                    "--expected-receipt-sha256",
                    receipt_sha256,
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(build.returncode, 0, build.stderr)
            self.assertIn(f"sha256={receipt_sha256}", build.stdout)

    def test_capture_rejects_a_goal_with_invalid_scope_contract(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            goal_path = write_design_goal(repo_root)
            goal = json.loads(goal_path.read_text(encoding="utf-8"))
            goal["validation"]["scopes"][0]["design_scope"] = "FR-1だけ"
            goal_path.write_text(
                json.dumps(goal, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(DesignValidationError, "design_scope"):
                validate_or_capture(
                    ISSUE,
                    ISSUE_URL,
                    ISSUE_UPDATED_AT,
                    repo_root / "issue-body.md",
                    repo_root / "docs" / "harness" / "rule-map.json",
                    repo_root,
                    WORKSPACE,
                    capture=True,
                    goal_document_path=goal_path,
                )
            self.assertFalse(canonical_receipt_path(repo_root, WORKSPACE).exists())

    def test_capture_uses_snapshot_and_rejects_later_design_drift(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            goal_path = write_design_goal(repo_root)
            workspace_root = canonical_receipt_path(repo_root, WORKSPACE).parent.parent
            design_path = workspace_root / "design-doc.json"
            display_path = workspace_root / "design-doc.md"
            snapshot_design = design_path.read_bytes()
            mismatched = json.loads(snapshot_design.decode("utf-8"))
            mismatched["validation"]["product_behaviors"][0]["change"] = "removed"
            mismatched_design = serialize_source(mismatched).encode("utf-8")
            mismatched_display = render_artifact_markdown(mismatched).encode("utf-8")
            original_validate = validate_build_entry.validate_design_artifact

            def swap_worktree_during_validation(*args, **kwargs):
                design_path.write_bytes(mismatched_design)
                display_path.write_bytes(mismatched_display)
                return original_validate(*args, **kwargs)

            with patch(
                "validate_build_entry.validate_design_artifact",
                side_effect=swap_worktree_during_validation,
            ):
                with self.assertRaisesRegex(
                    ValidationError,
                    "Design source changed after the handoff snapshot",
                ):
                    validate_or_capture(
                        ISSUE,
                        ISSUE_URL,
                        ISSUE_UPDATED_AT,
                        repo_root / "issue-body.md",
                        repo_root / "docs" / "harness" / "rule-map.json",
                        repo_root,
                        WORKSPACE,
                        capture=True,
                        goal_document_path=goal_path,
                    )
            self.assertFalse(canonical_receipt_path(repo_root, WORKSPACE).exists())

    def test_build_entry_rejects_upstream_change_after_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            _, receipt_sha256 = self.run_gate(repo_root, capture=True)
            workspace_root = canonical_receipt_path(repo_root, WORKSPACE).parent.parent
            design_path = workspace_root / "design-doc.json"
            display_path = workspace_root / "design-doc.md"
            changed = json.loads(design_path.read_text(encoding="utf-8"))
            changed["validation"]["product_behaviors"][0]["change"] = "removed"
            changed_design = serialize_source(changed).encode("utf-8")
            changed_display = render_artifact_markdown(changed).encode("utf-8")
            original_validate = validate_build_entry.validate_design_artifact

            def change_worktree_after_validation(*args, **kwargs):
                result = original_validate(*args, **kwargs)
                design_path.write_bytes(changed_design)
                display_path.write_bytes(changed_display)
                return result

            with patch(
                "validate_build_entry.validate_design_artifact",
                side_effect=change_worktree_after_validation,
            ):
                with self.assertRaisesRegex(
                    ValidationError,
                    "Design source changed after the handoff snapshot",
                ):
                    self.run_gate(
                        repo_root,
                        capture=False,
                        expected_receipt_sha256=receipt_sha256,
                    )

    def test_build_entry_rejects_git_baseline_change_after_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            _, receipt_sha256 = self.run_gate(repo_root, capture=True)
            workspace_root = canonical_receipt_path(repo_root, WORKSPACE).parent.parent
            design_path = workspace_root / "design-doc.json"
            original_validate = validate_build_entry.validate_design_artifact

            def change_head_after_validation(*args, **kwargs):
                result = original_validate(*args, **kwargs)
                run_git(repo_root, "add", str(design_path.relative_to(repo_root)))
                run_git(repo_root, "commit", "-qm", "change design baseline")
                return result

            with patch(
                "validate_build_entry.validate_design_artifact",
                side_effect=change_head_after_validation,
            ):
                with self.assertRaisesRegex(
                    ValidationError,
                    "Design Git HEAD baseline changed after the handoff snapshot",
                ):
                    self.run_gate(
                        repo_root,
                        capture=False,
                        expected_receipt_sha256=receipt_sha256,
                    )

    def test_build_entry_rejects_selected_rule_document_drift(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            _, receipt_sha256 = self.run_gate(
                repo_root,
                capture=True,
            )
            rule_path = repo_root / "docs" / "ai-driven-development" / "workflow.md"
            rule_path.write_text(
                rule_path.read_text(encoding="utf-8") + "changed rule\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValidationError, "do not match"):
                self.run_gate(
                    repo_root,
                    capture=False,
                    expected_receipt_sha256=receipt_sha256,
                )

    def test_check_rejects_a_stale_requirements_display(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            _, receipt_sha256 = self.run_gate(repo_root, capture=True)
            workspace_root = canonical_receipt_path(repo_root, WORKSPACE).parent.parent
            (workspace_root / "requirements.md").write_text(
                "changed requirements display\n", encoding="utf-8"
            )

            with self.assertRaisesRegex(ValidationError, "stale"):
                self.run_gate(
                    repo_root,
                    capture=False,
                    expected_receipt_sha256=receipt_sha256,
                )

    def test_check_rejects_a_stale_design_display(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            _, receipt_sha256 = self.run_gate(repo_root, capture=True)
            workspace_root = canonical_receipt_path(repo_root, WORKSPACE).parent.parent
            (workspace_root / "design-doc.md").write_text(
                "changed design display\n", encoding="utf-8"
            )

            with self.assertRaisesRegex(ValidationError, "stale"):
                self.run_gate(
                    repo_root,
                    capture=False,
                    expected_receipt_sha256=receipt_sha256,
                )

    def test_check_rejects_a_changed_issue_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            _, receipt_sha256 = self.run_gate(repo_root, capture=True)
            (repo_root / "issue-body.md").write_text(
                "changed Issue body\n", encoding="utf-8"
            )

            with self.assertRaisesRegex(
                (ValidationError, DesignValidationError),
                "revalidation failed|do not match",
            ):
                self.run_gate(
                    repo_root,
                    capture=False,
                    expected_receipt_sha256=receipt_sha256,
                )

    def test_check_rejects_semantically_equal_noncanonical_receipt_json(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            receipt_path, _ = self.run_gate(repo_root, capture=True)
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
            receipt_path.write_text(
                json.dumps(receipt, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            changed_receipt_sha256 = hashlib.sha256(
                receipt_path.read_bytes()
            ).hexdigest()

            with self.assertRaisesRegex(ValidationError, "canonical JSON"):
                self.run_gate(
                    repo_root,
                    capture=False,
                    expected_receipt_sha256=changed_receipt_sha256,
                )

    def test_check_rejects_replaced_receipt_before_artifact_validation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            receipt_path, receipt_sha256 = self.run_gate(repo_root, capture=True)
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
            receipt["issue"]["title"] = "Replacement title"
            receipt_path.write_text(
                json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValidationError, "completion evidence"):
                self.run_gate(
                    repo_root,
                    capture=False,
                    expected_receipt_sha256=receipt_sha256,
                )


if __name__ == "__main__":
    unittest.main()
