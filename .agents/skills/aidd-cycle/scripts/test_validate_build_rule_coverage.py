from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from artifact_source import serialize_source
from render_aidd_artifact import render_artifact_markdown
from test_validate_build_entry import initialize_repo, write_design_goal
from test_validate_design_coverage import WORKSPACE, design_goal_source, design_source
from validate_build_entry import canonical_receipt_path, validate_or_capture
from validate_build_rule_coverage import ValidationError, validate
from rule_coverage import (
    expand_rule_closure,
    matching_surfaces,
    rules_for_surfaces,
    validate_review_routing,
)
from validate_requirements_goal import validate_rule_map


def capture(repo_root: Path) -> str:
    issue_body_path = repo_root / "issue-body.md"
    rule_map_path = repo_root / "docs" / "harness" / "rule-map.json"
    goal_path = write_design_goal(repo_root)
    _, receipt_sha256 = validate_or_capture(
        "owner/repo#1639",
        "https://github.com/owner/repo/issues/1639",
        "2026-08-11T00:00:00Z",
        issue_body_path,
        rule_map_path,
        repo_root,
        WORKSPACE,
        capture=True,
        goal_document_path=goal_path,
    )
    return receipt_sha256


def add_surface(repo_root: Path, surface: dict[str, object]) -> None:
    rule_map_path = repo_root / "docs" / "harness" / "rule-map.json"
    rule_map = json.loads(rule_map_path.read_text(encoding="utf-8"))
    rule_map["review_routing"]["surfaces"].append(surface)
    rule_map_path.write_text(
        json.dumps(rule_map, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def set_design_surfaces(repo_root: Path, surfaces: list[str]) -> Path:
    workspace_root = (
        repo_root / "docs" / "ai-driven-development" / "workspaces" / WORKSPACE
    )
    requirements_path = workspace_root / "requirements.json"
    requirements_digest = hashlib.sha256(requirements_path.read_bytes()).hexdigest()
    design = design_source(requirements_digest)
    design["validation"]["rule_coverage"]["implementation_surfaces"] = surfaces
    design_path = workspace_root / "design-doc.json"
    design_path.write_text(serialize_source(design), encoding="utf-8")
    (workspace_root / "design-doc.md").write_text(
        render_artifact_markdown(design), encoding="utf-8"
    )
    goal = design_goal_source(requirements_digest)
    goal["validation"]["rule_coverage"]["implementation_surfaces"] = surfaces
    goal_path = repo_root / "design-goal.json"
    goal_path.write_text(serialize_source(goal), encoding="utf-8")
    return goal_path


def write_changed_file(repo_root: Path, relative_path: str) -> None:
    path = repo_root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("export const changed = true;\n", encoding="utf-8")


class BuildRuleCoverageTest(unittest.TestCase):
    def test_accepts_actual_diff_covered_by_design_surface(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            receipt_sha256 = capture(repo_root)
            write_changed_file(repo_root, "apps/web/feature.ts")

            record = validate(repo_root, WORKSPACE, receipt_sha256)

            self.assertEqual(record["implementation_surfaces"], ["test-workflow"])
            self.assertEqual(record["checked_rules"], ["ai-driven.workflow"])
            self.assertEqual(record["unresolved"], [])

    def test_rejects_surface_found_only_in_actual_diff(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            add_surface(
                repo_root,
                {
                    "id": "special-surface",
                    "paths": ["apps/special/**"],
                    "required_rules": ["ai-driven.workflow"],
                },
            )
            receipt_sha256 = capture(repo_root)
            write_changed_file(repo_root, "apps/special/feature.ts")

            with self.assertRaisesRegex(ValidationError, "undeclared Design surfaces"):
                validate(repo_root, WORKSPACE, receipt_sha256)

    def test_rejects_required_rule_missing_from_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            add_surface(
                repo_root,
                {
                    "id": "special-surface",
                    "paths": ["apps/special/**"],
                    "required_rules": ["policy.extra"],
                },
            )
            goal_path = set_design_surfaces(
                repo_root,
                ["test-workflow", "special-surface"],
            )
            _, _ = validate_or_capture(
                "owner/repo#1639",
                "https://github.com/owner/repo/issues/1639",
                "2026-08-11T00:00:00Z",
                repo_root / "issue-body.md",
                repo_root / "docs" / "harness" / "rule-map.json",
                repo_root,
                WORKSPACE,
                capture=True,
                goal_document_path=goal_path,
            )
            receipt_path = canonical_receipt_path(repo_root, WORKSPACE)
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
            receipt["selected_rules"] = [
                entry
                for entry in receipt["selected_rules"]
                if entry["id"] != "policy.extra"
            ]
            receipt_path.write_text(
                json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            forged_sha256 = hashlib.sha256(receipt_path.read_bytes()).hexdigest()
            write_changed_file(repo_root, "apps/special/feature.ts")

            with self.assertRaisesRegex(ValidationError, "absent from the Design receipt"):
                validate(repo_root, WORKSPACE, forged_sha256)

    def test_rejects_governed_path_without_surface(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo_root = Path(directory).resolve()
            initialize_repo(repo_root)
            rule_map_path = repo_root / "docs" / "harness" / "rule-map.json"
            rule_map = json.loads(rule_map_path.read_text(encoding="utf-8"))
            rule_map["review_routing"]["surfaces"][0]["paths"] = ["apps/web/**"]
            rule_map_path.write_text(
                json.dumps(rule_map, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            receipt_sha256 = capture(repo_root)
            write_changed_file(repo_root, "apps/api/unknown.sql")

            with self.assertRaisesRegex(ValidationError, "has no review surface"):
                validate(repo_root, WORKSPACE, receipt_sha256)


class CanonicalRoutingTest(unittest.TestCase):
    def test_web_tsx_surface_requires_design_rules(self) -> None:
        repo_root = Path(__file__).resolve().parents[4]
        rule_map = json.loads(
            (repo_root / "docs" / "harness" / "rule-map.json").read_text(
                encoding="utf-8"
            )
        )
        rules_by_id = validate_rule_map(rule_map)
        routing = validate_review_routing(rule_map, rules_by_id)

        surfaces = matching_surfaces(
            "apps/web/src/features/settings/LanguageForm.tsx",
            routing,
        )
        selected_rules = expand_rule_closure(
            rules_for_surfaces(surfaces, routing),
            rules_by_id,
        )

        self.assertEqual(surfaces, ["web-project", "web-source"])
        self.assertIn("web.design-rules", selected_rules)
        self.assertIn("web.test-policy", selected_rules)


if __name__ == "__main__":
    unittest.main()
