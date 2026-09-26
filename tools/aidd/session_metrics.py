#!/usr/bin/env python3
"""Codex セッション内の AIDD 作業時間と観測済みトークン数を記録する。"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from uuid import uuid4

TASK_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")
USAGE_FIELDS = ("input_tokens", "output_tokens", "total_tokens")


def codex_home() -> Path:
    return Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))


def default_store(root: Path) -> Path:
    result = subprocess.run(
        ["git", "-C", str(root), "rev-parse", "--git-common-dir"],
        check=True, capture_output=True, text=True,
    )
    common = Path(result.stdout.strip())
    if not common.is_absolute():
        common = root / common
    return common.resolve() / "aidd-metrics" / "usage.jsonl"


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def current_cycle(root: Path, task_id: str) -> str:
    if not TASK_ID.fullmatch(task_id):
        raise ValueError("Task ID が不正です")
    events = root / ".aidd" / "v4" / task_id / "events"
    files = sorted(events.glob("*.json"))
    if not files:
        raise ValueError(f"Task {task_id} のサイクル記録がありません")
    event = json.loads(files[-1].read_text())
    cycle = event.get("cycle_id")
    if not isinstance(cycle, str) or not cycle.startswith(f"{task_id}/cycle-"):
        raise ValueError(f"Task {task_id} のサイクルIDを取得できません")
    return cycle


def find_transcript(session: str, explicit: str | None) -> Path | None:
    if explicit:
        path = Path(explicit)
        return path if path.is_file() else None
    home = codex_home()
    paths = list(home.glob(f"sessions/*/*/*/*{session}.jsonl"))
    paths.extend(home.glob(f"archived_sessions/*{session}.jsonl"))
    return max(paths, key=lambda p: p.stat().st_mtime) if paths else None


def usage_sample(session: str, explicit: str | None) -> dict | None:
    path = find_transcript(session, explicit)
    if path is None:
        return None
    latest: dict[str, dict] = {}
    transcript_session: str | None = None
    with path.open() as transcript:
        for line in transcript:
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue  # 書込中の最終行は計測値に使わない
            payload = item.get("payload", {})
            if item.get("type") == "session_meta":
                transcript_session = payload.get("id")
                if transcript_session != session:
                    return None
            source = None
            counts = None
            if item.get("type") == "token_usage_record" and payload.get("session_id") == session:
                source = "token_usage_record"
                counts = payload.get("thread_token_usage")
            elif item.get("type") == "event_msg" and payload.get("type") == "token_count":
                source = "token_count"
                counts = (payload.get("info") or {}).get("total_token_usage")
            if not isinstance(counts, dict) or any(
                not isinstance(counts.get(key), int) or counts[key] < 0 for key in USAGE_FIELDS
            ):
                continue
            sample = {
                "source": source,
                "ordinal": item.get("ordinal"),
                "counts": {key: counts[key] for key in USAGE_FIELDS},
            }
            previous = latest.get(source)
            if previous is None or (sample["ordinal"] or -1) > (previous["ordinal"] or -1):
                latest[source] = sample
    if transcript_session != session:
        return None
    return latest.get("token_usage_record") or latest.get("token_count")


def usage_delta(start: dict | None, end: dict | None) -> tuple[dict | None, str]:
    if start is None or end is None:
        return None, "トークン使用量の観測値がありません"
    if start["source"] != end["source"]:
        return None, "観測値の形式が途中で変わりました"
    if not isinstance(start["ordinal"], int) or not isinstance(end["ordinal"], int) or end["ordinal"] <= start["ordinal"]:
        return None, "終了時点の新しい観測値がありません"
    delta = {key: end["counts"][key] - start["counts"][key] for key in USAGE_FIELDS}
    if any(value < 0 for value in delta.values()):
        return None, "トークン使用量の累積値が減少しました"
    return delta, "観測済みの使用量"


def read_events(handle) -> list[dict]:
    handle.seek(0)
    return [json.loads(line) for line in handle if line.strip()]


def append_event(handle, event: dict) -> None:
    handle.seek(0, os.SEEK_END)
    handle.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n")
    handle.flush()
    os.fsync(handle.fileno())


def open_starts(events: list[dict]) -> list[dict]:
    finished = {event["start_id"] for event in events if event.get("kind") == "finish"}
    return [event for event in events if event.get("kind") == "start" and event["id"] not in finished]


def start(args) -> None:
    cycle = current_cycle(Path(args.root), args.task)
    event = {
        "kind": "start",
        "id": str(uuid4()),
        "session": args.session,
        "task": args.task,
        "cycle": cycle,
        "stage": args.stage,
        "started_at": timestamp(),
        "clock_ns": time.monotonic_ns(),
        "usage": usage_sample(args.session, args.transcript),
    }
    with Path(args.store).open("a+", encoding="utf-8") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        if any(item["session"] == args.session for item in open_starts(read_events(handle))):
            raise ValueError("このセッションには終了していない工程があります")
        append_event(handle, event)
    print(f"計測開始: {args.session} / {args.task} / {cycle} / {args.stage}")


def finish(args) -> None:
    cycle = current_cycle(Path(args.root), args.task)
    with Path(args.store).open("a+", encoding="utf-8") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        starts = [item for item in open_starts(read_events(handle)) if item["session"] == args.session and item["task"] == args.task]
        if len(starts) != 1:
            raise ValueError("終了対象の工程が一意に見つかりません")
        started = starts[0]
        if started["cycle"] != cycle:
            raise ValueError("サイクルが切り替わっています。元のサイクルに属する工程として確認してください")
        duration_ns = time.monotonic_ns() - started["clock_ns"]
        observed, note = usage_delta(started["usage"], usage_sample(args.session, args.transcript))
        event = {
            "kind": "finish",
            "start_id": started["id"],
            "ended_at": timestamp(),
            "duration_seconds": round(duration_ns / 1_000_000_000, 3) if duration_ns >= 0 else None,
            "tokens": observed,
            "token_note": note,
        }
        append_event(handle, event)
    duration = f'{event["duration_seconds"]}秒' if event["duration_seconds"] is not None else "取得不可"
    tokens = f'観測値 {observed["total_tokens"]}トークン' if observed is not None else f"取得不可（{note}）"
    print(f'計測結果: {args.session} / {args.task} / {cycle} / {started["stage"]}: {duration}, {tokens}')


def report(args) -> None:
    with Path(args.store).open("a+", encoding="utf-8") as handle:
        fcntl.flock(handle, fcntl.LOCK_SH)
        events = read_events(handle)
    starts = {event["id"]: event for event in events if event.get("kind") == "start"}
    rows = []
    for event in events:
        if event.get("kind") != "finish" or event.get("start_id") not in starts:
            continue
        started = starts[event["start_id"]]
        if args.task and started["task"] != args.task:
            continue
        if args.cycle and started["cycle"] != args.cycle:
            continue
        if args.session and started["session"] != args.session:
            continue
        if args.since and started["started_at"][:10] < args.since:
            continue
        rows.append({key: started[key] for key in ("session", "task", "cycle", "stage", "started_at")} | {
            key: event[key] for key in ("ended_at", "duration_seconds", "tokens", "token_note")
        })
    groups: dict[tuple[str, str], list[dict]] = {}
    for row in rows:
        groups.setdefault((row["task"], row["cycle"]), []).append(row)
    result = {"records": rows, "groups": []}
    for (task, cycle), items in sorted(groups.items()):
        result["groups"].append({
            "task": task,
            "cycle": cycle,
            "sessions": sorted({item["session"] for item in items}),
            "duration_seconds": round(sum(item["duration_seconds"] for item in items), 3) if all(item["duration_seconds"] is not None for item in items) else None,
            "total_tokens": sum(item["tokens"]["total_tokens"] for item in items) if all(item["tokens"] is not None for item in items) else None,
            "records": len(items),
        })
    print(json.dumps(result, ensure_ascii=False, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("start", "finish", "report"))
    parser.add_argument("--root", default=".", help="AIDD Taskがあるrepository root")
    parser.add_argument("--store", help="省略時はGit common directory内")
    parser.add_argument("--session", help="start/finishの既定はCODEX_SESSION_ID。reportでは省略すると全セッション")
    parser.add_argument("--task")
    parser.add_argument("--stage")
    parser.add_argument("--cycle")
    parser.add_argument("--since", help="開始日 (YYYY-MM-DD)")
    parser.add_argument("--transcript", help="Codex transcriptのpath。省略時はsession IDから探索")
    args = parser.parse_args()
    if args.command in ("start", "finish"):
        args.session = args.session or os.environ.get("CODEX_SESSION_ID")
    if args.command in ("start", "finish") and (not args.session or not args.task):
        parser.error("start/finishにはセッションIDとTask IDが必要です")
    if args.command == "start" and not args.stage:
        parser.error("startには工程名が必要です")
    try:
        args.store = args.store or str(default_store(Path(args.root).resolve()))
        path = Path(args.store)
        path.parent.mkdir(parents=True, exist_ok=True)
        {"start": start, "finish": finish, "report": report}[args.command](args)
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as exc:
        print(f"計測エラー: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
