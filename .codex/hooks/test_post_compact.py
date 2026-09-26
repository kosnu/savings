import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
CONFIG = json.loads((ROOT / ".codex/hooks.json").read_text())
SESSION_START = CONFIG["hooks"]["SessionStart"][0]
COMMAND = SESSION_START["hooks"][0]["command"]


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
        self.assertEqual(set(CONFIG["hooks"]), {"SessionStart"})
        self.assertEqual(SESSION_START["matcher"], "^compact$")
        result = self.run_hook(
            json.dumps({"hook_event_name": "SessionStart", "source": "compact"})
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)
        self.assertEqual(set(output), {"hookSpecificOutput"})
        self.assertEqual(
            set(output["hookSpecificOutput"]), {"hookEventName", "additionalContext"}
        )
        self.assertEqual(output["hookSpecificOutput"]["hookEventName"], "SessionStart")
        self.assertIn("Coreのstatus", output["hookSpecificOutput"]["additionalContext"])

    def test_compaction_reentry_has_the_same_output(self) -> None:
        payload = json.dumps({"hook_event_name": "SessionStart", "source": "compact"})
        first = self.run_hook(payload)
        second = self.run_hook(payload)
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(first.stdout, second.stdout)

    def test_other_events_and_session_sources_do_nothing(self) -> None:
        for event in (
            {"hook_event_name": "PostCompact", "trigger": "auto"},
            {"hook_event_name": "SessionStart", "source": "startup"},
            {"hook_event_name": "SessionStart", "source": "resume"},
            {"hook_event_name": "SessionStart", "source": "clear"},
            {"hook_event_name": "SessionStart", "source": "unknown"},
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

    @unittest.skipUnless(os.environ.get("CODEX_HOOK_HOST_TEST") == "1", "Codex実機検証")
    def test_codex_parses_session_start_context(self) -> None:
        # 同じSessionStart出力契約をstartupで実機解析し、compactへの限定は設定と入力のテストで確認する。
        auth = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")) / "auth.json"
        if not auth.is_file() or not shutil.which("codex"):
            self.skipTest("Codex CLIまたは認証情報がない")

        token = "AIDD_HOOK_SESSION_START_CONTEXT_1824"
        with tempfile.TemporaryDirectory(prefix="aidd-hook-host-") as directory:
            root = Path(directory) / "repo"
            root.mkdir()
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            home = Path(directory) / "home"
            home.mkdir(mode=0o700)
            shutil.copyfile(auth, home / "auth.json")
            (home / "auth.json").chmod(0o600)
            (home / "config.toml").write_text(
                f'[projects."{root}"]\ntrust_level = "trusted"\n'
            )

            hook_dir = root / ".codex"
            hook_dir.mkdir()
            wrapper = hook_dir / "host_check.py"
            wrapper.write_text(
                "import json, subprocess, sys\n"
                "event = json.load(sys.stdin)\n"
                "event['source'] = 'compact'\n"
                "result = subprocess.run("
                f"[sys.executable, {str(ROOT / '.codex/hooks/post_compact.py')!r}], "
                "input=json.dumps(event), capture_output=True, text=True, check=True)\n"
                "output = json.loads(result.stdout)\n"
                f"output['hookSpecificOutput']['additionalContext'] += ' {token}'\n"
                "json.dump(output, sys.stdout)\n"
            )
            (hook_dir / "hooks.json").write_text(
                json.dumps(
                    {
                        "hooks": {
                            "SessionStart": [
                                {
                                    "matcher": "^startup$",
                                    "hooks": [
                                        {
                                            "type": "command",
                                            "command": f"{shlex.quote(sys.executable)} {shlex.quote(str(wrapper))}",
                                        }
                                    ],
                                }
                            ]
                        }
                    }
                )
            )
            result = subprocess.run(
                [
                    "codex",
                    "exec",
                    "--dangerously-bypass-hook-trust",
                    "--ephemeral",
                    "--json",
                    "-C",
                    str(root),
                    "Without tools, return only the probe token from SessionStart additional context. Otherwise return NONE.",
                ],
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                timeout=90,
                env={**os.environ, "CODEX_HOME": str(home)},
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            messages = [
                event["item"]["text"]
                for line in result.stdout.splitlines()
                if (event := json.loads(line)).get("type") == "item.completed"
                and event["item"]["type"] == "agent_message"
            ]
            self.assertEqual(messages, [token], result.stdout)


if __name__ == "__main__":
    unittest.main()
