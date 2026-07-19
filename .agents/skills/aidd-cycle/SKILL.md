---
name: aidd-cycle
description: Run one complete repository AI Driven Development cycle in a single invocation by setting, executing, and completing one phase Goal at a time according to the repository workflow. Use when the user asks to run or start an AIDD cycle or wants the full cycle completed end to end. Resume only when the same cycle is identifiable; otherwise start a new cycle from the workflow-defined entry phase.
---

# AIDD Cycle

## Purpose

Run one complete AIDD cycle in one invocation while keeping one active Codex
Goal at a time. Use `goal-setting` to construct each phase Goal; this skill owns
Goal execution and cycle control. Keep workflow phases in separate Goals.

## Canonical Sources

Read these before starting:

- `docs/ai-driven-development/workflow.md`
- `.agents/skills/goal-setting/SKILL.md`
- `docs/harness/rule-map.json`

`workflow.md` is the source of truth for phase order, phase responsibilities,
artifact boundaries, phase completion, Stop conditions, and post-cycle handling.
This skill only orchestrates that workflow and must not redefine it.

## Cycle Identity

Call `get_goal` when available before creating a Goal. Identify a cycle by a
stable cycle ID, workspace, Issue or initial input, and artifact lineage. Put
that identity in every phase Goal's Context Packet.

Start a new cycle when the user requests a fresh cycle, supplies fresh initial
input, the previous cycle is complete, or the available identity is ambiguous.
Allocate a new cycle ID and safe workspace or artifact lineage; earlier-cycle
artifacts remain read-only.

Resume only when the same cycle identity and its active or last completed phase
are clear. Goal completion evidence, not artifact existence alone, determines
where execution continues. An unfinished Goal belonging to another task is a
conflict and must not be replaced.

## Execution

Repeat until the canonical workflow reaches its final phase:

1. Determine the current or next phase from `workflow.md` and verified Goal
   state.
2. Confirm that no unfinished unrelated Goal conflicts with the phase.
3. If the phase Goal is not active, follow the orchestrated-use procedure in
   `goal-setting` to construct and set exactly one Goal. Do not put cycle-control
   work in that Goal.
4. Execute only the active Goal under its Context Packet, matching template,
   selected rule-map subgraph, and canonical workflow boundaries.
5. When a Stop condition applies, leave the Goal unfinished, report the blocker,
   and end this invocation.
6. When the objective, Done checks, and Verification are complete, call
   `update_goal` with `status: complete`, confirm completion with `get_goal`, and
   continue according to `workflow.md`.

After the canonical final phase completes, end the invocation and report the
completed cycle. Do not start another cycle or invoke a separate post-cycle
skill automatically.

## Goal Tool Fallback

The full cycle requires `create_goal`, `get_goal`, and `update_goal`. If they are
unavailable, or the user asks for text only, do not claim to have run the cycle.
Return a concise blocker and use `goal-setting` only to prepare an explicitly
requested phase draft.

## Stop

Stop when cycle identity is unsafe, an unrelated unfinished Goal exists,
required upstream input is missing, a safe new artifact lineage cannot be
allocated, advancing would violate the canonical workflow or selected rules, or
the phase Goal cannot fit the `goal-setting` budget.

## Output

Use concise commentary for phase transitions. Return the final response only
after the canonical final phase completes or a Stop condition ends the cycle.
Name the last completed phase, verification evidence, and any blocker or
residual risk.
