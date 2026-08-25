from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

from validate_phase_execution_contract import (
    CONTRACT_RELATIVE_PATH,
    ContractError,
    validate_repository_contract,
)


REPO_ROOT = Path(__file__).resolve().parents[4]
FIXTURE_PATHS = (
    CONTRACT_RELATIVE_PATH,
    Path(".agents/skills/aidd-cycle/SKILL.md"),
    Path(".agents/skills/goal-setting/SKILL.md"),
    Path(".codex/config.toml"),
    Path(".codex/agents/aidd-requirements-design.toml"),
    Path(".codex/agents/aidd-build.toml"),
)


class PhaseAgentContractTest(unittest.TestCase):
    def fixture_root(self) -> Path:
        temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(temporary_directory.cleanup)
        root = Path(temporary_directory.name)
        for relative_path in FIXTURE_PATHS:
            destination = root / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(REPO_ROOT / relative_path, destination)
        return root

    def replace(self, root: Path, relative_path: Path, old: str, new: str) -> None:
        path = root / relative_path
        text = path.read_text(encoding="utf-8")
        self.assertIn(old, text)
        path.write_text(text.replace(old, new, 1), encoding="utf-8")

    def test_repository_contract_is_valid(self) -> None:
        validate_repository_contract(REPO_ROOT)

    def test_instruction_line_wrapping_does_not_change_semantics(self) -> None:
        root = self.fixture_root()
        self.replace(
            root,
            Path(".codex/agents/aidd-build.toml"),
            "prepared by the parent orchestrator.",
            "prepared by the parent\norchestrator.",
        )

        validate_repository_contract(root)

    def test_forbidden_identifier_is_rejected_in_any_wording(self) -> None:
        additions = (
            ("Call `get_goal`.", "get_goal"),
            ("Embedded use of create_goal is allowed.", "create_goal"),
            ("Use update_goal after validation.", "update_goal"),
            ("Run goal-setting for the next phase.", "goal-setting"),
        )
        for addition, identifier in additions:
            with self.subTest(identifier=identifier):
                root = self.fixture_root()
                self.replace(
                    root,
                    Path(".codex/agents/aidd-build.toml"),
                    "Complete only the active Build Goal",
                    f"{addition} Complete only the active Build Goal",
                )

                with self.assertRaisesRegex(
                    ContractError, f"forbidden identifier {identifier}"
                ):
                    validate_repository_contract(root)

    def test_assignment_table_drift_is_rejected(self) -> None:
        root = self.fixture_root()
        self.replace(
            root,
            Path(".agents/skills/aidd-cycle/SKILL.md"),
            "| Design | `aidd-requirements-design` |",
            "| Design | `aidd-build` |",
        )

        with self.assertRaisesRegex(ContractError, "phase assignment table"):
            validate_repository_contract(root)

    def test_conflicting_phase_responsibility_is_rejected(self) -> None:
        root = self.fixture_root()
        self.replace(
            root,
            Path(".codex/agents/aidd-build.toml"),
            "Complete only the active Build Goal",
            "Commit, push, open a PR, and start Ship. Complete only the active Build Goal",
        )

        with self.assertRaisesRegex(
            ContractError, "instructions contain forbidden identifier ship"
        ):
            validate_repository_contract(root)

    def test_canonical_instructions_cannot_grant_ship_responsibility(self) -> None:
        root = self.fixture_root()
        addition = "Commit, push, open a PR, and start Ship. "
        for relative_path in (
            CONTRACT_RELATIVE_PATH,
            Path(".codex/agents/aidd-build.toml"),
        ):
            self.replace(
                root,
                relative_path,
                "Complete only the active Build Goal",
                f"{addition}Complete only the active Build Goal",
            )

        with self.assertRaisesRegex(
            ContractError, "canonical instructions.*forbidden identifier"
        ):
            validate_repository_contract(root)

    def test_agent_registration_drift_is_rejected(self) -> None:
        root = self.fixture_root()
        self.replace(
            root,
            Path(".codex/config.toml"),
            'config_file = "./agents/aidd-build.toml"',
            'config_file = "./agents/context-scout.toml"',
        )

        with self.assertRaisesRegex(
            ContractError, "aidd-build config_file must be"
        ):
            validate_repository_contract(root)

    def test_agent_name_drift_is_rejected(self) -> None:
        root = self.fixture_root()
        self.replace(
            root,
            Path(".codex/agents/aidd-build.toml"),
            'name = "aidd-build"',
            'name = "aidd-build-renamed"',
        )

        with self.assertRaisesRegex(ContractError, "agent config name"):
            validate_repository_contract(root)

    def test_parent_goal_ownership_drift_is_rejected(self) -> None:
        root = self.fixture_root()
        self.replace(
            root,
            CONTRACT_RELATIVE_PATH,
            'owner = "parent"',
            'owner = "phase-agent"',
        )

        with self.assertRaisesRegex(
            ContractError, "goal_lifecycle.owner must be 'parent'"
        ):
            validate_repository_contract(root)

    def test_boolean_contract_version_is_rejected(self) -> None:
        root = self.fixture_root()
        self.replace(
            root,
            CONTRACT_RELATIVE_PATH,
            "version = 1",
            "version = true",
        )

        with self.assertRaisesRegex(ContractError, "version 1"):
            validate_repository_contract(root)

    def test_goal_setting_requires_contract_validator(self) -> None:
        root = self.fixture_root()
        self.replace(
            root,
            Path(".agents/skills/goal-setting/SKILL.md"),
            "python3 .agents/skills/aidd-cycle/scripts/validate_phase_execution_contract.py",
            "python3 disabled-phase-execution-validator.py",
        )

        with self.assertRaisesRegex(ContractError, "must run phase contract validator"):
            validate_repository_contract(root)

    def test_ship_assignment_drift_is_rejected(self) -> None:
        root = self.fixture_root()
        self.replace(
            root,
            Path(".agents/skills/aidd-cycle/SKILL.md"),
            "| Ship | parent agent | current selection |",
            "| Ship | `aidd-build` | `.codex/agents/aidd-build.toml` |",
        )

        with self.assertRaisesRegex(ContractError, "phase assignment table"):
            validate_repository_contract(root)


if __name__ == "__main__":
    unittest.main()
