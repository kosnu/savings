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

    def test_goal_lifecycle_contract_remains_with_the_phase_agent(self) -> None:
        for path in PHASE_AGENT_PATHS:
            with self.subTest(path=path):
                instructions = path.read_text(encoding="utf-8")
                self.assertIn("call get_goal", instructions)
                self.assertIn("terminal Goal update", instructions)
                self.assertNotIn(
                    "Do not call create_goal, get_goal, or update_goal",
                    instructions,
                )


if __name__ == "__main__":
    unittest.main()
