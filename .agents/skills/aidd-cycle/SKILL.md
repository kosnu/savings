---
name: aidd-cycle
description: Run one complete repository AI Driven Development cycle in a single invocation by sequentially setting and completing separate Codex Goals for Intent / Requirements, Design / Plan, Build / Verify, and Ship. Use when the user asks to run or start an AIDD cycle or wants Requirements through Ship completed end to end. Start every new or ambiguous cycle from Requirements, and resume only when the same cycle is identifiable. Keep only one phase Goal active at a time. Keep Learn outside this cycle, after Ship, and run it only when the user invokes it separately.
---

# AIDD Cycle

## Purpose

Run one complete AIDD cycle in one invocation while preserving a separate Codex
Goal for each phase. Create, execute, and complete the phase Goals sequentially;
never run them in parallel or combine them into one Goal.

Keep `goal-setting` responsible for constructing each phase Goal. Keep this
skill responsible for executing the current Goal and advancing the cycle.

## Required Inputs

Before starting the cycle, read:

- `.agents/skills/goal-setting/SKILL.md`
- `docs/ai-driven-development/workflow.md`
- `docs/harness/rule-map.json`

For each phase, read the matching Goal template and the references selected by
`goal-setting`. Treat the workflow and selected Markdown documents as the source
of truth; this skill is only an orchestration layer.

## Cycle Contract

Run only this sequence:

1. Intent / Requirements
2. Design / Plan
3. Build / Verify
4. Ship

One `$aidd-cycle` invocation owns and continues through the full sequence to
Ship. Advance automatically after the active phase reaches Done, completes
Verification, and has no Stop condition.

Use one active Goal at a time:

- Set one phase Goal with the `goal-setting` procedure.
- Execute only that Goal until it is complete or stopped.
- Mark it complete only after its own objective has no required work remaining.
- Create the next phase Goal only after the previous Goal is complete.
- Keep next-Goal creation outside every phase Goal objective.

The phase after a completed Build / Verify Goal is Ship, and Ship completes this
cycle. `Learn` is a separate, user-invoked skill after Ship. When another cycle
is needed, the user may run `$learn` and start another `$aidd-cycle` invocation.

For a request that names only one phase rather than the full cycle, use
`$goal-setting` instead of this skill.

## Cycle Identity and Entry State

Call `get_goal` before creating the first phase Goal when it is available.

Identify a cycle by one stable cycle ID, workspace, Issue or initial input, and
artifact lineage. Include that identity in every phase Goal's Context Packet and
keep it consistent through all four Goals. Artifact existence alone does not
prove phase completion; use Goal Done and Verification evidence.

Resolve new-cycle intent before considering resume. Start a new cycle from
Intent / Requirements when any of these applies:

- The user says `new cycle`, `2周目`, `最初から`, or otherwise explicitly asks
  for a fresh cycle.
- The invocation supplies fresh initial input or output from a separately run
  `$learn`.
- The previous cycle's Ship Goal is complete.
- No existing cycle can be identified, or the available evidence is ambiguous.

For a new cycle, allocate a new cycle ID and a new workspace or artifact
lineage. Treat artifacts from earlier cycles as read-only and never overwrite
them, even when the topic or Issue is the same. If the new initial input or a
safe new lineage cannot be determined, stop for that missing input; do not fall
back to resuming an older cycle.

Resume only when no new-cycle signal applies and the same cycle identity is
clear. Resume the active phase when its Goal is unfinished. When a same-cycle
Goal completed before the next Goal was created, continue from its successor:

- completed Intent / Requirements -> Design / Plan
- completed Design / Plan -> Build / Verify
- completed Build / Verify -> Ship

An explicit `再開` or `続き` request still requires evidence of the same cycle
identity. If that identity cannot be established, stop rather than attaching the
request to a possibly unrelated cycle.

An unfinished Goal that clearly belongs to another task remains a conflict;
stop without creating another Goal.

## Sequential Execution

Repeat these steps for Intent / Requirements, Design / Plan, Build / Verify, and
Ship:

1. Call `get_goal` when available. Confirm that no unfinished unrelated Goal
   conflicts with the phase.
2. If the phase Goal is not already active, follow the orchestrated-use rules in
   `.agents/skills/goal-setting/SKILL.md` to construct and set exactly one Goal.
   Put the stable cycle ID, workspace, Issue or initial input, artifact lineage,
   and current phase in its Context Packet. Keep the 3800-character limit, phase
   boundaries, Done, Verification, and Stop conditions. Do not add cycle-control
   work to the Goal objective.
3. Execute the active phase Goal. Keep generated `requirements.md` and
   `design-doc.md` read-only after their creation phase.
4. Complete all phase-local test failures, type errors, lint failures,
   consistency issues, and required verification inside the current phase when
   its rules permit them.
5. If a Stop condition applies, do not mark the Goal complete and do not create
   the next Goal. Report the blocker and end the cycle invocation.
6. When the phase objective is fully achieved, call `update_goal` with
   `status: complete`.
7. Call `get_goal` when available and confirm completion before creating the
   next phase Goal.

After Ship completes, end the invocation and report the completed cycle. Do not
start another cycle.

## Goal Tool Fallback

Running the full cycle with separate phase Goals requires `create_goal`,
`get_goal`, and `update_goal`.

If the required Goal tools are unavailable, or the user asks for drafts or text
only, do not claim to have run the cycle. Return a concise blocker and use
`$goal-setting` to prepare only the explicitly requested phase draft.

## Stop

Stop the sequence when:

- An unfinished unrelated Goal exists.
- An explicit resume request lacks evidence of the same cycle identity.
- A new cycle lacks usable initial input or a safe new workspace or artifact
  lineage.
- The current phase is missing required upstream inputs.
- Advancing would edit a generated upstream artifact.
- The next phase would require scope, behavior, or constraints not established
  by upstream inputs.
- A phase Goal cannot fit the `goal-setting` character budget.
- A workflow, selected rule, or policy violation cannot be resolved inside the
  current phase.

## Output

Use concise commentary for intermediate phase transitions. Return a final
response only after Ship completes or a Stop condition ends the sequence. The
final response must name the last completed phase, verification evidence, and
any blocker or residual risk.
