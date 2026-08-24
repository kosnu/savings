from __future__ import annotations

import re
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
SKILL_PATH = REPOSITORY_ROOT / ".agents" / "skills" / "aidd-cycle" / "SKILL.md"
CONFIG_PATH = REPOSITORY_ROOT / ".codex" / "config.toml"
PHASE_AGENT_PATHS = (
    REPOSITORY_ROOT / ".codex" / "agents" / "aidd-requirements-design.toml",
    REPOSITORY_ROOT / ".codex" / "agents" / "aidd-build.toml",
)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def description(text: str) -> str:
    match = re.search(r'^description = "([^"]+)"$', text, re.MULTILINE)
    if match is None:
        raise AssertionError("agent description is missing")
    return match.group(1)


def registered_agent_section(config: str, agent_name: str) -> str:
    match = re.search(
        rf"^\[agents[.]{re.escape(agent_name)}\]\n(.*?)(?=^\[|\Z)",
        config,
        re.MULTILINE | re.DOTALL,
    )
    if match is None:
        raise AssertionError(f"registered agent is missing: {agent_name}")
    return match.group(1)


class PhaseExecutorContractTest(unittest.TestCase):
    def test_parent_is_the_only_goal_lifecycle_owner(self) -> None:
        skill = read_text(SKILL_PATH)

        self.assertIn(
            "Only the parent calls `create_goal`,\n"
            "   `get_goal`, or `update_goal`; these operations are not delegated.",
            skill,
        )
        self.assertIn(
            "reruns every Verification command recorded in the Goal\n"
            "   and every required phase gate",
            skill,
        )
        self.assertIn("interrupt the agent", skill)
        self.assertIn("requires\n   the same phase Goal to remain active", skill)

    def test_phase_agents_cannot_depend_on_local_goal_state(self) -> None:
        for path in PHASE_AGENT_PATHS:
            with self.subTest(path=path):
                instructions = read_text(path)

                self.assertIn(
                    "Do not call create_goal, get_goal, or update_goal",
                    instructions,
                )
                for tool_name in ("create_goal", "get_goal", "update_goal"):
                    self.assertEqual(instructions.count(tool_name), 1)
                self.assertIn(
                    "Do not claim that the Goal is complete or blocked.",
                    instructions,
                )

    def test_registered_descriptions_match_phase_agent_descriptions(self) -> None:
        config = read_text(CONFIG_PATH)

        for path in PHASE_AGENT_PATHS:
            with self.subTest(path=path):
                agent = read_text(path)
                agent_name = path.stem
                section = registered_agent_section(config, agent_name)

                self.assertEqual(section.count(description(agent)), 1)
                self.assertIn(
                    f'config_file = "./agents/{path.name}"',
                    section,
                )


if __name__ == "__main__":
    unittest.main()
