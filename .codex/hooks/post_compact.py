import json
import sys

CONTEXT = (
    "AIDD v4の再開時は、会話で明示されたTask IDからCoreのstatusと最新checkpointを読み、"
    "Intent、実行権限、判断revision、証拠の鮮度を確認してください。"
    "Task IDをGoal本文や会話要約から推測しないでください。"
    "このHookは再開の案内のみで、AIDDの状態や検証証拠ではありません。"
)


def main() -> int:
    try:
        event = json.load(sys.stdin)
    except (json.JSONDecodeError, UnicodeDecodeError):
        print("PostCompact Hookの入力JSONを読めません", file=sys.stderr)
        return 1

    if not isinstance(event, dict):
        print("PostCompact Hookの入力はJSON objectが必要です", file=sys.stderr)
        return 1

    if event.get("hook_event_name") != "PostCompact":
        return 0
    if event.get("trigger") not in {"auto", "manual"}:
        return 0

    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PostCompact",
                "additionalContext": CONTEXT,
            }
        },
        sys.stdout,
        ensure_ascii=False,
    )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
