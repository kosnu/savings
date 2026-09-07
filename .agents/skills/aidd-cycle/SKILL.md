---
name: aidd-cycle
description: Execute an Issue-specified development request using the repository default AIDD vNext protocol and one Development Goal. Apply when the user asks to implement or fix a GitHub Issue, even without naming AIDD. Do not start for questions, explanations, investigations, or design proposals alone.
---

# AIDD Development adapter

Read `docs/ai-driven-development/workflow.md`, `aidd-checker.md`,
`aidd-checker-operations.md`, `codex-adapter.md` and the applicable rule-map subgraph.
The repository owns the contract; this skill adapts it to Codex.

Fetch the specified Issue and distinguish execution from read-only discussion.
Keep the Issue as human intent, derive the Task objective/constraints/Done/verification,
and default delivery to pr through commit, push, PR creation/update and delivery read-back.
Only an explicit user restriction narrows that scope; record it in existing constraints
and Done. Do not infer a restriction from agent-generated local settings or ask for
additional Ship authorization. Do not require implementation
paths or routing keywords in the Issue. Missing product intent needs clarification;
ordinary technical choices inside the delegated scope do not.

Use one Development Goal for the entire task. Apply `goal-setting` once and keep the
same Goal through Explore/Decide, checkpoint, Build/Verify/Review and authorized Ship.
Use actual Goal tools to check availability. If unavailable, retain the Task contract
and continue without claiming a Goal exists. Do not replace another unfinished Goal.

Prepare the dedicated clean worktree and branch before task-start. Build the checker
from the accepted checkout into a task-specific external binary path. Keep that exact
binary throughout the task, especially Learn. Never replace it to make a gate pass.
Run task-start, checkpoint, verify, check, and finish as documented in operations.
For delivery=pr, stage the verified result and run ship-check before committing, then
push, create/update the PR and read back delivery state. For delivery=local under an
explicit user restriction, run finish without ship-check or PR delivery operations.
Retain task/checkpoint/evidence identities in repository records and execution context.
Do not copy complete hashes, inventories or decisions into Goal prose.
After committing, continue review corrections in the same Task and Goal. Preserve
the original baseline, append a checkpoint when decisions change, and reverify all changes.

Explore and decide iteratively. Before implementing a changed decision, append a new
checkpoint against the latest parent identity. Never recapture the baseline or rewrite
an old checkpoint. Re-run verification after every revision or relevant state change.
Review all applicable rules and actual behavior; formal coverage does not prove semantics.

Do not modify Development guardrails. If a guardrail needs changing, preserve the
unfinished task and hand off to an explicitly authorized independent Learn. Do not
mark an unfinished Development Goal complete to make room for Learn.

Use the currently selected model and perform work in the main agent by default.
Delegate only when the cost-benefit conditions in AGENTS.md are met,
with explicit ownership, Task/checkpoint identity, verification and
read/write boundaries. A worktree has one writer; use separate worktrees for concurrent
implementation and verify the integrated result. Parent owns Goal state. A subagent's
claim of completion is not evidence.

Complete only after Done, verification, review and the authorized delivery are fulfilled.
By default this requires PR Ship and delivery read-back; local verification or Core gates
alone are insufficient. When an explicit user restriction sets delivery=local, satisfying
Done, verification, review and finish completes Development within that restriction.
Do not split into phase Goals, require a fixed executor, invoke legacy phase commands,
or automatically continue from completed Development into Learn.
