---
name: goal-setting
description: Use Codex Goal tools for authorized Development or an explicit Goal request. Goal setup alone does not authorize task execution.
---

# Goal setting

This skill is the entrypoint for Codex Goal tools. Apply the
[Codex adapter](../../../docs/ai-driven-development/codex-adapter.md#goal機能との接続)
for Task/Goal correspondence, authority, and lifecycle. Execution flow and protocol
remain in the canonical documents linked there.

Use the host's actual Goal tools:

- Check tool availability and the current Goal with `get_goal` before creating one.
  Reuse the same task's Goal; preserve unrelated unfinished Goals and user-owned pauses.
- Use `create_goal` with the authorized task's objective and a reference to its records.
  Use [Goal templates](../../../docs/ai-driven-development/goal-templates/index.md) for
  the compact content; set a token budget only when explicitly requested.
- Use `update_goal` only when the canonical completion criteria and host state rules
  permit that transition. A Goal state does not replace Task verification evidence.

If Goal tools are unavailable, report that and return to the authorized task under
the same Core contract without claiming a Goal exists. This skill does not add
execution permission: Goal setup alone is not a request to perform the task, and
guardrail maintenance in the same Task keeps its Goal. Learn does not start a
standalone Task or Goal.
