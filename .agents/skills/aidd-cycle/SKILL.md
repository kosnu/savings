---
name: aidd-cycle
description: Implement or fix a specified GitHub Issue through AIDD Development and PR delivery. Questions and design proposals alone do not start execution.
---

# AIDD Development adapter

The repository owns the contract; this skill adapts it to Codex.
Apply [workflow](../../../docs/ai-driven-development/workflow.md) and
[Codex adapter](../../../docs/ai-driven-development/codex-adapter.md) for task authority
and lifecycle. Use [checker architecture](../../../docs/ai-driven-development/aidd-checker.md)
for integrity boundaries and [operations](../../../docs/ai-driven-development/aidd-checker-operations.md)
when preparing the checker or running task commands. Read the applicable rule-map
subgraph and all required dependencies; conditional references do not reduce coverage.

Fetch the specified Issue and distinguish execution from read-only discussion.
Keep the Issue as human intent, derive the Task objective/constraints/Done/verification,
and carry out commit, push, PR creation/update and delivery read-back by default.
Only an explicit user restriction narrows that scope; record it in existing constraints
and Done. Do not infer a restriction from agent-generated delivery classifications or ask for
additional Ship authorization. Do not require implementation
paths or routing keywords in the Issue. Missing product intent needs clarification;
ordinary technical choices inside the delegated scope do not.

Use one Development Goal for the entire task. Apply `goal-setting` once and keep the
same Goal through Explore/Decide, checkpoint, Build/Verify/Review and authorized Ship.
Use actual Goal tools to check availability. If unavailable, retain the Task contract
and continue without claiming a Goal exists. Do not replace another unfinished Goal.

Prepare the dedicated clean worktree and branch before task-start. Run the documented aidd-prepare command from the accepted checkout. It automatically
selects or builds the input-matched cached checker and verifies its hash. Keep the returned
absolute binary path throughout the task, especially Learn; do not re-prepare mid-task
or replace it to make a gate pass.
Run task-start, checkpoint, verify, check, and finish as documented in operations.
For authorized Ship, stage the verified result and run ship-check before committing, then
push, create/update the PR and read back delivery state. When the user explicitly limits
work to verification, run finish. Do not add a delivery field to the Task.
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
Delegate only when the cost-benefit conditions in AGENTS.md are met.
When delegating, specify ownership, Task/checkpoint identity, verification and
read/write boundaries explicitly. A worktree has one writer; use separate worktrees for concurrent
implementation and verify the integrated result. Parent owns Goal state. A subagent's
claim of completion is not evidence.

Complete only after Done, verification, review and the authorized delivery are fulfilled.
By default this requires PR Ship and delivery read-back; local verification or Core gates
alone are insufficient. When an explicit user restriction limits work to verification, satisfying
Done, verification, review and finish completes Development within that restriction.
Do not split into phase Goals, require a fixed executor, invoke legacy phase commands,
or automatically continue from completed Development into Learn.
