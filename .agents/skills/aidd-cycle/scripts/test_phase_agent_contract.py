from __future__ import annotations

import re
import tomllib
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
SKILL_PATH = REPO_ROOT / ".agents" / "skills" / "aidd-cycle" / "SKILL.md"
GOAL_SETTING_PATH = (
    REPO_ROOT / ".agents" / "skills" / "goal-setting" / "SKILL.md"
)
CONFIG_PATH = REPO_ROOT / ".codex" / "config.toml"

PHASE_AGENTS = {
    "aidd-requirements-design": "./agents/aidd-requirements-design.toml",
    "aidd-build": "./agents/aidd-build.toml",
}


class PhaseAgentContractTest(unittest.TestCase):
    def test_parent_skill_owns_goal_lifecycle(self) -> None:
        skill = " ".join(SKILL_PATH.read_text(encoding="utf-8").split())

        self.assertIn(
            "The parent orchestrator exclusively owns every phase Goal lifecycle operation",
            skill,
        )
        self.assertIn(
            "Delegated phase executors never invoke Goal tools or change Goal state",
            skill,
        )
        self.assertIn(
            "For every phase, only after its phase-specific checks and the objective, Done conditions, and Verification are satisfied, the parent calls `update_goal(status: complete)`",
            skill,
        )
        self.assertIn(
            "The parent calls `get_goal`, independently confirms the required phase evidence, and owns any `update_goal` call.",
            skill,
        )

    def test_goal_setting_is_parent_only(self) -> None:
        skill = " ".join(GOAL_SETTING_PATH.read_text(encoding="utf-8").split())

        self.assertIn(
            "This skill is used by the parent AIDD orchestrator.",
            skill,
        )
        self.assertIn(
            "Delegated phase executors must not invoke this skill or any Goal lifecycle tool",
            skill,
        )

    def test_registered_phase_agent_configs_are_valid_and_read_only_for_goals(
        self,
    ) -> None:
        config = tomllib.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        agents = config["agents"]

        for agent_name, config_file in PHASE_AGENTS.items():
            with self.subTest(agent=agent_name):
                registration = agents[agent_name]
                self.assertEqual(registration["config_file"], config_file)

                agent_path = REPO_ROOT / ".codex" / config_file.removeprefix("./")
                agent_config = tomllib.loads(agent_path.read_text(encoding="utf-8"))
                self.assertEqual(agent_config["name"], agent_name)

                instructions = agent_config["developer_instructions"]
                self.assertIn(
                    "Do not invoke Goal lifecycle tools (`get_goal`, `create_goal`, or `update_goal`) or `goal-setting`.",
                    instructions,
                )
                self.assertIn(
                    "Do not create, complete, block, or otherwise update a Goal.",
                    instructions,
                )
                self.assertIn(
                    "owns the Goal lifecycle decision",
                    instructions,
                )
                self.assertNotRegex(
                    instructions,
                    re.compile(
                        r"(?im)^\s*(?:at the start,\s*)?(?:call|invoke)\s+"
                        r"(?:get_goal|create_goal|update_goal)"
                    ),
                )
                self.assertNotIn("terminal Goal update", instructions)


if __name__ == "__main__":
    unittest.main()
