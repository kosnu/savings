from __future__ import annotations

import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
PHASE_AGENT_PATHS = (
    REPOSITORY_ROOT / ".codex" / "agents" / "aidd-requirements-design.toml",
    REPOSITORY_ROOT / ".codex" / "agents" / "aidd-build.toml",
)


class PhaseAgentTargetStateContractTest(unittest.TestCase):
    def test_phase_agents_declare_schema_v3_target_state_contract(self) -> None:
        for path in PHASE_AGENT_PATHS:
            with self.subTest(path=path):
                instructions = path.read_text(encoding="utf-8")
                self.assertIn("schema v3", instructions)
                self.assertIn("target_state", instructions)
                self.assertIn("ownership scopes", instructions)
                self.assertIn("verification case", instructions)

    def test_phase_agents_preserve_behavior_and_executable_identity(self) -> None:
        design_instructions = PHASE_AGENT_PATHS[0].read_text(encoding="utf-8")
        build_instructions = PHASE_AGENT_PATHS[1].read_text(encoding="utf-8")

        self.assertIn("substantive descriptions", design_instructions)
        self.assertIn("case-sensitive canonical", design_instructions)
        self.assertIn("receipt-fixed product behavior descriptions", build_instructions)
        self.assertIn("case-sensitive canonical", build_instructions)

    def test_goal_lifecycle_contract_remains_with_the_parent(self) -> None:
        for path in PHASE_AGENT_PATHS:
            with self.subTest(path=path):
                instructions = path.read_text(encoding="utf-8")
                self.assertIn("parent orchestrator", instructions)
                self.assertIn(
                    "Do not create, complete, block, or otherwise update a Goal",
                    instructions,
                )
                self.assertNotIn("call get_goal", instructions)
                self.assertNotIn("terminal Goal update", instructions)


if __name__ == "__main__":
    unittest.main()
