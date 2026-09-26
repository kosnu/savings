import argparse
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock
import os

from tools.aidd import session_metrics


class SessionMetricsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.store = self.root / "metrics.jsonl"
        self.task_event("task-a", "task-a/cycle-0001")
        self.task_event("task-b", "task-b/cycle-0001")

    def task_event(self, task, cycle):
        directory = self.root / ".aidd" / "v4" / task / "events"
        directory.mkdir(parents=True, exist_ok=True)
        number = len(list(directory.glob("*.json"))) + 1
        (directory / f"{number:06d}.json").write_text(json.dumps({"cycle_id": cycle}))

    def args(self, session, task, stage=None, **extra):
        return argparse.Namespace(
            root=str(self.root), store=str(self.store), session=session, task=task,
            stage=stage, transcript=None, cycle=None, since=None, **extra,
        )

    @staticmethod
    def sample(position, tokens):
        return {
            "source": "token_usage_record", "position": position,
            "counts": {"input_tokens": tokens - 2, "output_tokens": 2, "total_tokens": tokens},
        }

    def capture(self, function, args):
        output = io.StringIO()
        with redirect_stdout(output):
            function(args)
        return output.getvalue()

    def test_records_sessions_tasks_cycles_and_actual_stages(self):
        for session, task, stage in (
            ("session-one", "task-a", "設計"),
            ("session-two", "task-a", "検証"),
            ("session-one", "task-b", "調査"),
        ):
            with mock.patch.object(session_metrics, "usage_sample", side_effect=[self.sample(1, 10), self.sample(2, 25)]):
                self.capture(session_metrics.start, self.args(session, task, stage))
                message = self.capture(session_metrics.finish, self.args(session, task))
            self.assertIn("15トークン", message)

        self.task_event("task-a", "task-a/cycle-0002")
        with mock.patch.object(session_metrics, "usage_sample", side_effect=[self.sample(3, 25), self.sample(4, 40)]):
            self.capture(session_metrics.start, self.args("session-one", "task-a", "改善"))
            self.capture(session_metrics.finish, self.args("session-one", "task-a"))

        result = json.loads(self.capture(session_metrics.report, self.args(None, None)))
        self.assertEqual(4, len(result["records"]))
        group = next(item for item in result["groups"] if item["cycle"] == "task-a/cycle-0001")
        self.assertEqual(["session-one", "session-two"], group["sessions"])
        self.assertEqual(30, group["total_tokens"])
        self.assertEqual({"設計", "検証", "調査", "改善"}, {item["stage"] for item in result["records"]})
        filtered = json.loads(self.capture(session_metrics.report, self.args("session-one", "task-a")))
        self.assertEqual(2, len(filtered["records"]))
        self.assertEqual({"task-a/cycle-0001", "task-a/cycle-0002"}, {item["cycle"] for item in filtered["records"]})

    def test_missing_or_stale_usage_is_unknown(self):
        with mock.patch.object(session_metrics, "usage_sample", side_effect=[None, self.sample(2, 25)]):
            self.capture(session_metrics.start, self.args("session-one", "task-a", "実装"))
            message = self.capture(session_metrics.finish, self.args("session-one", "task-a"))
        self.assertIn("取得不可", message)
        result = json.loads(self.capture(session_metrics.report, self.args(None, None)))
        self.assertIsNone(result["records"][0]["tokens"])
        self.assertIsNone(result["groups"][0]["total_tokens"])
        self.assertIsNone(session_metrics.usage_delta(self.sample(2, 25), self.sample(2, 25))[0])

    def test_cycle_switch_does_not_reassign_an_open_stage(self):
        with mock.patch.object(session_metrics, "usage_sample", return_value=self.sample(1, 10)):
            self.capture(session_metrics.start, self.args("session-one", "task-a", "改善"))
        self.task_event("task-a", "task-a/cycle-0002")
        with self.assertRaisesRegex(ValueError, "サイクルが切り替わって"):
            self.capture(session_metrics.finish, self.args("session-one", "task-a"))

    def test_only_one_open_stage_per_session(self):
        with mock.patch.object(session_metrics, "usage_sample", return_value=self.sample(1, 10)):
            self.capture(session_metrics.start, self.args("session-one", "task-a", "設計"))
            with self.assertRaisesRegex(ValueError, "終了していない工程"):
                self.capture(session_metrics.start, self.args("session-one", "task-b", "実装"))

    def test_usage_reads_only_matching_session_and_skips_partial_lines(self):
        transcript = self.root / "rollout-session-one.jsonl"
        lines = [
            {"ordinal": 1, "type": "session_meta", "payload": {"id": "session-one"}},
            {"ordinal": 2, "type": "token_usage_record", "payload": {"session_id": "another", "thread_token_usage": self.sample(2, 100)["counts"]}},
            {"ordinal": 3, "type": "token_usage_record", "payload": {"session_id": "session-one", "thread_token_usage": self.sample(3, 30)["counts"]}},
            {"ordinal": 4, "type": "event_msg", "payload": {"type": "token_count", "info": {"total_token_usage": self.sample(4, 30)["counts"]}}},
        ]
        transcript.write_text("\n".join(json.dumps(line) for line in lines) + "\n{partial")
        observed = session_metrics.usage_sample("session-one", str(transcript))
        self.assertEqual(30, observed["counts"]["total_tokens"])
        self.assertEqual("token_usage_record", observed["source"])
        self.assertIsNone(session_metrics.usage_sample("session-two", str(transcript)))

    def test_usage_without_ordinal_uses_latest_transcript_line(self):
        transcript = self.root / "rollout-session-one.jsonl"
        counts = lambda total: {"input_tokens": total - 2, "output_tokens": 2, "total_tokens": total}
        transcript.write_text("\n".join(json.dumps(item) for item in (
            {"type": "session_meta", "payload": {"id": "session-one"}},
            {"type": "event_msg", "payload": {"type": "token_count", "info": {"total_token_usage": counts(12)}}},
        )) + "\n")
        start = session_metrics.usage_sample("session-one", str(transcript))
        with transcript.open("a") as output:
            output.write(json.dumps({"type": "event_msg", "payload": {
                "type": "token_count", "info": {"total_token_usage": counts(23)},
            }}) + "\n")
        end = session_metrics.usage_sample("session-one", str(transcript))
        self.assertEqual(3, end["position"])
        self.assertEqual(11, session_metrics.usage_delta(start, end)[0]["total_tokens"])

    def test_reboot_or_clock_change_makes_duration_unknown(self):
        with mock.patch.object(session_metrics, "usage_sample", return_value=None), mock.patch.object(
            session_metrics, "boot_id", side_effect=["boot-a", "boot-b"]
        ), mock.patch.object(session_metrics.time, "monotonic_ns", side_effect=[100_000_000_000, 200_000_000_000]), mock.patch.object(
            session_metrics.time, "time_ns", side_effect=[1_000_000_000_000, 1_100_000_000_000]
        ):
            self.capture(session_metrics.start, self.args("session-one", "task-a", "実装"))
            self.capture(session_metrics.finish, self.args("session-one", "task-a"))
        result = json.loads(self.capture(session_metrics.report, self.args(None, None)))
        self.assertIsNone(result["records"][0]["duration_seconds"])

    def test_changed_clock_origin_makes_positive_duration_unknown(self):
        with mock.patch.object(session_metrics, "usage_sample", return_value=None), mock.patch.object(
            session_metrics, "boot_id", return_value=None
        ), mock.patch.object(session_metrics.time, "monotonic_ns", side_effect=[100_000_000_000, 200_000_000_000]), mock.patch.object(
            session_metrics.time, "time_ns", side_effect=[1_000_000_000_000, 1_200_000_000_000]
        ):
            self.capture(session_metrics.start, self.args("session-one", "task-a", "実装"))
            self.capture(session_metrics.finish, self.args("session-one", "task-a"))
        result = json.loads(self.capture(session_metrics.report, self.args(None, None)))
        self.assertIsNone(result["records"][0]["duration_seconds"])

    def test_continuous_clock_retains_duration(self):
        with mock.patch.object(session_metrics, "usage_sample", return_value=None), mock.patch.object(
            session_metrics, "boot_id", return_value="boot-a"
        ), mock.patch.object(session_metrics.time, "monotonic_ns", side_effect=[100_000_000_000, 103_000_000_000]), mock.patch.object(
            session_metrics.time, "time_ns", side_effect=[1_000_000_000_000, 1_003_000_000_000]
        ):
            self.capture(session_metrics.start, self.args("session-one", "task-a", "実装"))
            self.capture(session_metrics.finish, self.args("session-one", "task-a"))
        result = json.loads(self.capture(session_metrics.report, self.args(None, None)))
        self.assertEqual(3.0, result["records"][0]["duration_seconds"])

    def test_partial_store_tail_preserves_records_and_allows_new_events(self):
        with mock.patch.object(session_metrics, "usage_sample", return_value=None):
            self.capture(session_metrics.start, self.args("session-one", "task-a", "設計"))
            self.capture(session_metrics.finish, self.args("session-one", "task-a"))
            with self.store.open("a") as output:
                output.write('{"kind":"start"')
            self.assertEqual(1, len(json.loads(self.capture(session_metrics.report, self.args(None, None)))["records"]))
            self.capture(session_metrics.start, self.args("session-one", "task-a", "検証"))
            self.capture(session_metrics.finish, self.args("session-one", "task-a"))
        result = json.loads(self.capture(session_metrics.report, self.args(None, None)))
        self.assertEqual(2, len(result["records"]))
        self.assertEqual(4, len(self.store.read_text().splitlines()))

    def test_valid_store_tail_without_newline_keeps_events_separate(self):
        with mock.patch.object(session_metrics, "usage_sample", return_value=None):
            self.capture(session_metrics.start, self.args("session-one", "task-a", "設計"))
            self.store.write_text(self.store.read_text().rstrip("\n"))
            self.capture(session_metrics.finish, self.args("session-one", "task-a"))
        result = json.loads(self.capture(session_metrics.report, self.args(None, None)))
        self.assertEqual(1, len(result["records"]))
        self.assertEqual(2, len(self.store.read_text().splitlines()))

    def test_corrupt_complete_store_line_remains_an_error(self):
        self.store.write_text('{"kind":"start"}\nnot-json\n')
        with self.assertRaises(json.JSONDecodeError):
            self.capture(session_metrics.report, self.args(None, None))

    def test_report_defaults_to_all_sessions_even_with_session_environment(self):
        for session in ("session-one", "session-two"):
            with mock.patch.object(session_metrics, "usage_sample", side_effect=[self.sample(1, 10), self.sample(2, 25)]):
                self.capture(session_metrics.start, self.args(session, "task-a", "検証"))
                self.capture(session_metrics.finish, self.args(session, "task-a"))
        with mock.patch.dict(os.environ, {"CODEX_SESSION_ID": "session-one"}), mock.patch(
            "sys.argv", ["session_metrics.py", "report", "--store", str(self.store)]
        ):
            output = io.StringIO()
            with redirect_stdout(output):
                self.assertEqual(0, session_metrics.main())
            result = json.loads(output.getvalue())
        self.assertEqual(2, len(result["records"]))


if __name__ == "__main__":
    unittest.main()
