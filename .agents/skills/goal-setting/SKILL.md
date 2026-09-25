---
name: goal-setting
description: Use Codex Goal tools when host conditions and the user request authorize a Goal.
---

# Goal setting

Apply the [Codex adapter](../../../docs/ai-driven-development/codex-adapter.md).
Inspect the current Goal and the host's actual tool contract. Create a Goal only when that
contract permits it; if explicit user instruction is required, development authority alone
is insufficient. Goal setup alone does not authorize execution.
The parent agent owns the same Task's Goal. Preserve unrelated Goals and user-owned pauses.
Use the Intent objective and Task reference; set budgets only when explicitly requested.
Goal state never replaces Core evidence. Do not mark the cycle complete before Audit or
while proposed improvements await manual approval. Continue authorized Task work without
a Goal when no Goal is authorized or available.
