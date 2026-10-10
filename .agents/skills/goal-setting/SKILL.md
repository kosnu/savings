---
name: goal-setting
description: Create or continue a Codex Goal for an authorized AIDD Task when host conditions permit; handle explicit Goal-use requests.
---

# Goal setting

Apply the [Codex adapter's Goal policy](../../../docs/ai-driven-development/codex-adapter.md#goal機能との接続)
for starting, creating, continuing, and completing a Goal.
Inspect the host's actual tool contract and current Goal. When explicit instruction is
required, a request such as “1881をGoalを使って対応して” permits Goal use;
ordinary development authority or a repository policy alone does not.
Goal setup alone does not authorize Task execution. Continue authorized Task work without
a Goal when creation is not authorized or the tools are unavailable.

The parent agent continues the same Task's existing Goal without duplication. Preserve
unrelated unfinished Goals and user-owned pauses. Use the Intent objective, source, Task
reference, and authorized completion scope; set budgets only when explicitly requested.
Goal state never replaces actual verification and delivery checks. Follow the Core phase-result contract; do not create Task/operation events, snapshots, Ship records, or persist command stdout/stderr. Complete a Ship-scoped Goal after its outcome,
verification, review, and delivery checks are satisfied. Report Goal completion separately
from cycle completion; Audit and improvements retain their explicit request and approval
boundaries.
