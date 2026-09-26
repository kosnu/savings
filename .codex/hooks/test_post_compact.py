import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
CONFIG = json.loads((ROOT / ".codex/hooks.json").read_text())
COMMAND = CONFIG["hooks"]["PostCompact"][0]["hooks"][0]["command"]


class PostCompactHookTest(unittest.TestCase):
    def run_hook(self, input_text: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            COMMAND,
            shell=True,
            cwd=ROOT / "docs",
            input=input_text,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_config_runs_from_repository_subdirectory(self) -> None:
        self.assertEqual(set(CONFIG["hooks"]), {"PostCompact"})
        result = self.run_hook(
            json.dumps({"hook_event_name": "PostCompact", "trigger": "auto"})
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)
        self.assertEqual(output["hookSpecificOutput"]["hookEventName"], "PostCompact")
        self.assertIn("Coreのstatus", output["hookSpecificOutput"]["additionalContext"])
        self.assertNotIn("decision", output)
        self.assertNotIn("continue", output)

    def test_manual_compaction_has_the_same_reentry_safe_output(self) -> None:
        payload = json.dumps({"hook_event_name": "PostCompact", "trigger": "manual"})
        first = self.run_hook(payload)
        second = self.run_hook(payload)
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(first.stdout, second.stdout)

    def test_other_events_and_unknown_triggers_do_nothing(self) -> None:
        for event in (
            {"hook_event_name": "Stop", "trigger": "auto"},
            {"hook_event_name": "PostCompact", "trigger": "unknown"},
        ):
            with self.subTest(event=event):
                result = self.run_hook(json.dumps(event))
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout, "")

    def test_invalid_input_fails_without_context(self) -> None:
        for payload in ("{", "[]"):
            with self.subTest(payload=payload):
                result = self.run_hook(payload)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, "")
                self.assertIn("入力", result.stderr)


if __name__ == "__main__":
    unittest.main()
