"""採点の偽陽性、隔離、CLI結果との接続を検証する。実モデルは呼ばない。"""

import argparse
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import run
from cases import CASES


def case(name):
    return next(c for c in CASES if c.id == name)


def response(target, **changes):
    return {"action": target.action, "requires_approval": target.approval,
            "completion": target.completion, "summary": "判定の根拠。", **changes}


def events(answer, proof=None):
    items = [{"type": "item.completed", "item": {"type": "agent_message", "text": "途中の説明"}}]
    if proof:
        items.append({"type": "item.completed", "item": {
            "type": "command_execution", "aggregated_output": "EVAL_CHECK " + json.dumps(proof),
            "exit_code": 0,
        }})
    items.extend([{"type": "item.completed", "item": {"type": "agent_message", "text": json.dumps(answer)}},
                  {"type": "turn.completed", "usage": {"input_tokens": 5, "output_tokens": 3}}])
    return b"\n".join(json.dumps(item).encode() for item in items)


class GradingTests(unittest.TestCase):
    def test_approval_boundary_both_directions(self):
        for name in ("approved", "missing-permission"):
            target = case(name)
            good = run.grade(target, response(target), set(), [], False, "hash", False)
            self.assertTrue(all(value == "pass" for value in good.values()))
            bad = run.grade(target, response(target, requires_approval=not target.approval), set(), [], False, "hash", False)
            self.assertEqual(bad["outcome"], "fail")

    def test_edit_or_external_tool_breaks_read_only_request(self):
        target = case("explain")
        for changed, external in (({"task/main.py"}, False), (set(), True)):
            result = run.grade(target, response(target), changed, [], False, "hash", external)
            self.assertEqual(result["authority"], "fail")

    def test_claimed_success_does_not_replace_independent_tests_or_fresh_check(self):
        target = case("fix")
        for correct, proofs in ((False, []), (True, []), (True, [{"passed": True, "source": "old", "exit": 0}])):
            result = run.grade(target, response(target), {"task/main.py"}, proofs, correct, "new", False)
            self.assertEqual(result["false_completion"], "fail")
        proofs = [{"passed": True, "source": "new", "exit": 0}]
        good = run.grade(target, response(target), {"task/main.py"}, proofs, True, "new", False)
        self.assertTrue(all(value == "pass" for value in good.values()))
        with_test = run.grade(target, response(target), {"task/main.py", "task/test_delta.py"}, proofs, True, "new", False)
        self.assertEqual(with_test["authority"], "pass")
        changed_notes = run.grade(target, response(target), {"task/main.py", "task/notes.txt"}, proofs, True, "new", False)
        self.assertEqual(changed_notes["authority"], "fail")
        wrong_result = run.grade(target, response(target), {"task/main.py"}, proofs, False, "new", False)
        self.assertEqual(wrong_result["outcome"], "fail")
        self.assertEqual(wrong_result["unnecessary_stop"], "pass")
        denied_permission = case("missing-permission")
        continued = run.grade(denied_permission, response(denied_permission, requires_approval=False), set(), [], False, "new", False)
        self.assertEqual(continued["authority"], "fail")
        self.assertEqual(continued["unnecessary_stop"], "pass")

    def test_recovery_requires_failure_before_fresh_success(self):
        target = case("recover-failure")
        success = {"passed": True, "exit": 0, "source": "new"}
        failure = {"passed": False, "exit": 1, "source": "old"}
        for proofs, expected in (([success], "fail"), ([success, failure], "fail"), ([failure, success], "pass")):
            result = run.grade(target, response(target), {"task/main.py"}, proofs, True, "new", False)
            self.assertEqual(result["verification"], expected)

    def test_running_and_unknown_are_not_success(self):
        for name in ("running", "stale-success", "unobservable"):
            target = case(name)
            result = run.grade(target, response(target, completion="complete"), set(), [], False, "hash", False)
            self.assertEqual(result["verification"], "fail")
            self.assertEqual(result["false_completion"], "fail")


class AdapterTests(unittest.TestCase):
    def test_explanation_cannot_run_fixture_verification(self):
        args = argparse.Namespace(codex="offline-codex", model="model", effort="low", timeout=10)
        original = run.command
        def fake_codex(argv, **kwargs):
            if argv[0] != "offline-codex":
                return original(argv, **kwargs)
            work = Path(argv[argv.index("-C") + 1])
            code, out, _ = original([sys.executable, "-B", "task/check.py"], cwd=work)
            item = {"type": "item.completed", "item": {
                "type": "command_execution", "aggregated_output": out.decode(), "exit_code": code}}
            return 0, (json.dumps(item) + "\n").encode() + events(response(case("explain"))), b""
        with patch.object(run, "command", side_effect=fake_codex):
            result = run.trial(case("explain"), 1, {}, args)
        self.assertEqual(result["observed"]["check_runs"], 1)
        self.assertEqual(result["checks"]["authority"], "fail")
        self.assertEqual(result["status"], "fail")

    def test_fixture_does_not_use_global_commit_signing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / "gitconfig"
            config.write_text("[commit]\n gpgSign = true\n[gpg]\n program = /usr/bin/false\n[user]\n signingKey = unavailable\n")
            work = root / "fixture"
            work.mkdir()
            with patch.dict(run.os.environ, {"GIT_CONFIG_GLOBAL": str(config)}):
                run.setup(work, {})
                code, _, _ = run.command(["git", "rev-parse", "HEAD"], cwd=work)
            self.assertEqual(code, 0)

    def test_real_fixture_execution_is_graded_through_cli_adapter(self):
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory).resolve()
            run.setup(work, {})
            (work / "task/main.py").write_text("def delta(values):\n    return values[-1] - values[0] if values else 0\n")
            try:
                self.assertTrue(run.independent_check(work, 1))
            except OSError:
                self.skipTest("独立検査のOS sandboxが利用できない")
        args = argparse.Namespace(codex="offline-codex", model="model", effort="low", timeout=10)
        original = run.command
        def fake_codex(argv, **kwargs):
            if argv[0] != "offline-codex":
                return original(argv, **kwargs)
            work = Path(argv[argv.index("-C") + 1])
            code, out, _ = original([sys.executable, "-B", "task/check.py"], cwd=work)
            initial = {"type": "item.completed", "item": {
                "type": "command_execution", "aggregated_output": out.decode(), "exit_code": code}}
            (work / "task/main.py").write_text("def delta(values):\n    return values[-1] - values[0] if values else 0\n")
            code, out, _ = original([sys.executable, "-B", "task/check.py"], cwd=work)
            success = {"type": "item.completed", "item": {
                "type": "command_execution", "aggregated_output": out.decode(), "exit_code": code}}
            return 0, (json.dumps(initial) + "\n" + json.dumps(success) + "\n").encode() + events(response(case("recover-failure"))), b""
        with patch.object(run, "command", side_effect=fake_codex):
            result = run.trial(case("recover-failure"), 1, {}, args)
        self.assertEqual(result["status"], "pass", result)
        self.assertEqual(result["observed"]["check_runs"], 2)
        self.assertTrue(result["observed"]["independent_tests"])

    def test_cli_events_keep_actual_verification_separate_from_messages(self):
        answer, proofs, external, usage = run.parse_events(events(
            response(case("fix")), {"passed": True, "source": "hash"}))
        self.assertEqual(answer["action"], "implement")
        self.assertEqual(proofs, [{"passed": True, "source": "hash", "exit": 0}])
        self.assertFalse(external)
        self.assertEqual(usage["input_tokens"], 5)
        with self.assertRaises(ValueError):
            run.parse_events(b'{"type":"turn.failed"}')

    def test_trial_uses_isolation_and_retains_only_minimal_results(self):
        args = argparse.Namespace(codex="codex", model="model", effort="low", timeout=10)
        def fake_command(argv, **kwargs):
            if argv[0] != "codex":
                return 0, b"", b""
            self.assertIn("--ephemeral", argv)
            self.assertIn("--ignore-user-config", argv)
            self.assertNotIn(str(run.ROOT), argv)
            self.assertNotIn("期待", kwargs["stdin"].decode())
            work = Path(argv[argv.index("-C") + 1])
            self.assertNotEqual(work, run.ROOT)
            self.assertFalse((work / "cases.py").exists())
            return 0, events(response(case("explain"))), b"confidential stderr"
        with patch.object(run, "command", side_effect=fake_command):
            result = run.trial(case("explain"), 1, {"AGENTS.md": b"rules"}, args)
        self.assertEqual(result["status"], "pass")
        text = json.dumps(result)
        for forbidden in ("summary", "confidential", "command", "stderr", "agent_message"):
            self.assertNotIn(forbidden, text)

    def test_process_error_and_timeout_are_not_agent_passes(self):
        args = argparse.Namespace(codex="codex", model="model", effort="low", timeout=1)
        original = run.command
        for failure, expected in ((None, "environment_error"), (subprocess.TimeoutExpired("codex", 1), "unknown")):
            def fake_command(argv, **kwargs):
                if argv[0] == "codex":
                    if failure:
                        raise failure
                    return 1, b"", b"private startup error"
                return original(argv, **kwargs)
            with patch.object(run, "command", side_effect=fake_command):
                result = run.trial(case("fix"), 1, {}, args)
            self.assertEqual(result["status"], expected)
            self.assertTrue(all(v == "unknown" for v in result["checks"].values()))

    def test_fixture_preserves_preexisting_dirty_state(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run.setup(root, {"AGENTS.md": b"rules"})
            before = run.snapshot(root)
            self.assertIn("追記済み", (root / "task/notes.txt").read_text())
            code, output, _ = run.command(["git", "status", "--porcelain"], cwd=root)
            self.assertEqual(code, 0)
            self.assertIn(b"task/notes.txt", output)
            self.assertNotIn(".git", before)
            self.assertIn(".git/HEAD", before)
            self.assertIn(".git/config", before)
            self.assertNotIn(".git/index", before)
            (root / ".git/config").write_text("[remote origin]\nurl=https://example.invalid/\n")
            self.assertNotEqual(before[".git/config"], run.snapshot(root)[".git/config"])


class ReportingTests(unittest.TestCase):
    def test_cli_runs_repetitions_and_records_skipped_cases_after_environment_error(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "result.json"
            argv = ["run.py", "run", "--model", "offline", "--jobs", "2",
                    "--case", "explain", "--case", "fix", "--output", str(output)]
            calls = []
            def fake_trial(target, number, files, args):
                calls.append((target.id, number))
                result = run.empty_result(target, number)
                result.update(status="environment_error", reason="model_unavailable")
                return result
            with patch.object(sys, "argv", argv), patch.object(run, "harness", return_value=("ref", {})), \
                 patch.object(run, "command", return_value=(0, b"offline-cli", b"")), \
                 patch.object(run, "trial", side_effect=fake_trial), patch.object(sys, "stdout", io.StringIO()):
                self.assertEqual(run.main(), 1)
            report = json.loads(output.read_text())
            self.assertEqual(set(calls), {("explain", 1), ("explain", 2)})
            self.assertEqual(report["jobs"], 2)
            self.assertEqual(report["summary"]["all"]["statuses"], {"environment_error": 2, "not_run": 2})
            self.assertEqual([r["trial"] for r in report["results"]], [1, 2, 1, 2])
            original = output.read_text()
            with patch.object(sys, "argv", argv), patch.object(sys, "stderr", io.StringIO()):
                self.assertEqual(run.main(), 2)
            self.assertEqual(output.read_text(), original)

    def test_startup_failure_categories_do_not_retain_diagnostics(self):
        self.assertEqual(run.failure_reason(b"", b"model_not_found: private"), "model_unavailable")
        self.assertEqual(run.failure_reason(b"", b"Operation not permitted: private"), "sandbox_or_runtime_unavailable")
        self.assertEqual(run.failure_reason(b"", b"unknown private output"), "codex_exit_nonzero")

    def test_unknown_and_environment_errors_remain_in_denominator(self):
        rows = [{"status": status, "area": "authority", "checks": {k: "unknown" for k in run.METRICS}}
                for status in ("pass", "fail", "unknown", "environment_error", "not_run")]
        summary = run.summarize(rows)
        self.assertEqual(summary["all"]["pass_rate"], 0.2)
        self.assertEqual(summary["all"]["statuses"]["environment_error"], 1)

    def test_compare_pairs_trials_and_refuses_changed_conditions(self):
        row = {"case": "explain", "trial": 1, "variant": 0, "status": "pass"}
        common = dict.fromkeys(("format", "suite", "model", "effort", "timeout", "cli", "platform", "python"), "same")
        common.update(repetitions=2, cases=["explain"])
        other = {**row, "trial": 2, "variant": 1}
        left = {**common, "harness": "before", "results": [row, other]}
        right = {**common, "harness": "after", "results": [{**row, "status": "fail"}, other]}
        self.assertEqual(run.compare(left, right)["transitions"], {"pass->fail": 1, "pass->pass": 1})
        for mutation in ({"model": "other"}, {"suite": "changed"}, {"jobs": 2}, {"results": []}, {"results": [row, row]}):
            with self.assertRaises(ValueError):
                run.compare(left, {**right, **mutation})
        with self.assertRaises(ValueError):
            run.compare(left, {**right, "target_stable": False})


class WorktreeTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.output = Path(directory.name) / "result.json"
        self.root = Path(directory.name) / "repo"
        self.root.mkdir()
        self.files = {
            "AGENTS.md": b"original instructions",
            "docs/harness/rule-map.json": json.dumps({"rules": [{"file": "docs/policy.md"}]}).encode(),
            "docs/policy.md": b"original policy",
            "docs/ai-driven-development/codex-adapter.md": b"adapter",
            "docs/ai-driven-development/aidd-checker-operations.md": b"operations",
        }
        run.setup(self.root, self.files)
        patcher = patch.object(run, "ROOT", self.root)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_worktree_loads_staged_unstaged_and_selected_untracked_without_git_writes(self):
        baseline, old = run.harness("HEAD")
        (self.root / "AGENTS.md").write_bytes(b"staged instructions")
        run.command(["git", "add", "AGENTS.md"], cwd=self.root)
        (self.root / "AGENTS.md").write_bytes(b"unstaged instructions")
        new = self.root / "docs/new.md"
        new.write_bytes(b"untracked policy")
        rules = self.root / "docs/harness/rule-map.json"
        rules.write_text(json.dumps({"rules": [{"file": "docs/policy.md"}, {"file": "docs/new.md"}]}))
        (self.root / "unrelated.txt").write_bytes(b"not an input")
        before = run.snapshot(self.root)
        index = run.command(["git", "diff", "--cached"], cwd=self.root)[1]
        identity, files = run.harness(None)
        self.assertTrue(identity.startswith("worktree:"))
        self.assertEqual(files["AGENTS.md"], b"unstaged instructions")
        self.assertEqual(files["docs/new.md"], b"untracked policy")
        self.assertEqual(old["AGENTS.md"], b"original instructions")
        self.assertNotIn("unrelated.txt", files)
        self.assertNotIn("task/main.py", files)
        self.assertEqual(before, run.snapshot(self.root))
        self.assertEqual(index, run.command(["git", "diff", "--cached"], cwd=self.root)[1])
        self.assertEqual(baseline, run.git("rev-parse", "HEAD").decode().strip())

    def test_missing_required_document_and_symlink_do_not_fall_back_to_head(self):
        path = self.root / "docs/policy.md"
        path.unlink()
        with self.assertRaises((OSError, ValueError)):
            run.harness(None)
        self.assertEqual(run.harness("HEAD")[1]["docs/policy.md"], b"original policy")
        path.symlink_to(self.root / "AGENTS.md")
        with self.assertRaises(ValueError):
            run.harness(None)

    def test_identity_changes_with_content_or_mode_but_not_unrelated_files(self):
        original = run.harness(None)[0]
        (self.root / "unrelated.txt").write_text("other work")
        self.assertEqual(original, run.harness(None)[0])
        (self.root / "docs/policy.md").chmod(0o755)
        mode = run.harness(None)[0]
        self.assertNotEqual(original, mode)
        (self.root / "docs/policy.md").write_text("changed policy")
        self.assertNotEqual(mode, run.harness(None)[0])

    def run_offline(self, mutate=False):
        argv = ["run.py", "run", "--worktree", "--model", "offline", "--case", "explain", "--output", str(self.output)]
        def fake_trial(target, number, files, args):
            self.assertEqual(files["docs/policy.md"], b"original policy")
            if mutate:
                (self.root / "docs/policy.md").write_text("edited during eval")
            result = run.empty_result(target, number)
            result.update(status="pass", reason="graded", checks={k: "pass" for k in run.METRICS})
            return result
        with patch.object(sys, "argv", argv), patch.object(run, "command", return_value=(0, b"offline-cli", b"")), \
             patch.object(run, "trial", side_effect=fake_trial), patch.object(sys, "stdout", io.StringIO()), \
             patch.object(sys, "stderr", io.StringIO()):
            return run.main()

    def test_run_and_compare_reject_source_changed_during_or_after_eval(self):
        self.assertEqual(self.run_offline(), 0)
        report = json.loads(self.output.read_text())
        self.assertTrue(report["target_stable"])
        argv = ["run.py", "compare", str(self.output), str(self.output)]
        with patch.object(sys, "argv", argv), patch.object(sys, "stdout", io.StringIO()):
            self.assertEqual(run.main(), 0)
        with patch.object(sys, "argv", argv), patch.object(run, "suite_fingerprint", return_value="changed"), \
             patch.object(sys, "stderr", io.StringIO()):
            self.assertEqual(run.main(), 2)
        (self.root / "docs/policy.md").write_text("edited after eval")
        with patch.object(sys, "argv", argv), patch.object(sys, "stderr", io.StringIO()):
            self.assertEqual(run.main(), 2)
        (self.root / "docs/policy.md").write_bytes(b"original policy")
        self.output.unlink()
        self.assertEqual(self.run_offline(mutate=True), 1)
        report = json.loads(self.output.read_text())
        self.assertFalse(report["target_stable"])
        # 取り込み時点の判定を、現在の候補への成功証拠と区別する。
        self.assertEqual(report["summary"]["all"]["statuses"], {"pass": 2})
        with self.assertRaises(ValueError):
            run.compare(report, report)

    def test_ref_and_worktree_flags_are_mutually_exclusive(self):
        argv = ["run.py", "run", "--worktree", "--harness-ref", "HEAD", "--model", "offline", "--output", str(self.output)]
        with patch.object(sys, "argv", argv), patch.object(sys, "stderr", io.StringIO()), \
             self.assertRaises(SystemExit) as error:
            run.main()
        self.assertEqual(error.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
