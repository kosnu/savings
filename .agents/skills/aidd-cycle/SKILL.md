---
name: aidd-cycle
description: Run one complete repository AI Driven Development cycle in a single invocation by setting, executing, and completing one phase Goal at a time according to the repository workflow. Use when the user asks to run or start an AIDD cycle or wants the full cycle completed end to end. Resume only when the same cycle is identifiable; otherwise start a new cycle from the workflow-defined entry phase.
---

# AIDD Cycle

Run the repository AIDD workflow end to end. This skill owns cycle identity,
phase transitions, and Goal execution. `goal-setting` owns construction of one
phase Goal.

## Read First

- `docs/ai-driven-development/workflow.md`
- `docs/ai-driven-development/issue-guidelines.md`
- `.agents/skills/goal-setting/SKILL.md`
- `docs/harness/rule-map.json`
- `references/artifact-validation.md` when entering Requirements or Design

The workflow is canonical. Do not add phase rules here or infer a phase from an
artifact's mere existence.

## Establish the Cycle

1. Call `get_goal` before `create_goal`.
2. If an unfinished Goal belongs to another task, preserve it and stop.
3. If an unfinished Goal belongs to this cycle, continue that Goal. A paused
   Goal is user- or system-owned state; report it and wait for resume instead of
   inventing a resume action.
4. Otherwise fetch the latest Issue body, canonical URL, and `updatedAt`. The
   exact body is the cycle's only Task Context.
5. Resolve one workspace for the Issue and run the workspace validator. Reuse
   the sole matching workspace; create `<number>-<short-title>` only when none
   exists; stop when more than one exists.
6. Record the Issue identity, body SHA-256, workspace, phase, and canonical
   artifact paths in every phase Goal.

Conversation, review comments, current diffs, prior artifacts, and newly
changed rules may explain execution or trigger a Stop, but cannot extend the
Requirements Task Context. Prior canonical artifacts are continuity baselines,
not additional requirements.

## Run the State Machine

For each phase in the workflow:

1. Reconfirm the current Goal state and the preceding phase's completion
   evidence.
2. Ask `goal-setting` to construct and set exactly the current phase Goal.
3. Execute only that Goal under its Context Packet and selected rule-map
   subgraph.
4. For Requirements and Design, run the pre-Goal and artifact gates in
   `references/artifact-validation.md`. Retain the validated temporary Goal JSON
   until its artifact gate succeeds.
5. When the objective, Done conditions, and Verification are satisfied, call
   `update_goal(status: complete)` and confirm the terminal state with
   `get_goal` before advancing.
6. While useful progress remains possible, keep the Goal active. Call
   `update_goal(status: blocked)` only after the same blocking condition has
   recurred for at least three consecutive Goal turns and no in-scope path can
   make progress; confirm the terminal state and end the cycle invocation.

Never have two phase Goals active at once. Never advance because files exist,
tests happened to pass, or a phase draft was produced.

## Artifact Boundary

- `requirements.json` and `design-doc.json` are machine sources of truth.
- `requirements.md` and `design-doc.md` are deterministic display outputs.
- Requirements owns only the Requirements pair; Design owns only the Design
  pair; later phases treat both pairs as read-only.
- Every regenerated artifact covers its complete upstream input. A delta marks
  changed records but never narrows Goal scope.
- Semantic identity lives in typed IDs, statuses, owners, roles, hashes, and
  references. Current schema-v2 validators also enforce canonical headings,
  substantive text, and unambiguous evidence mapping as artifact format gates;
  follow those gates from `references/artifact-validation.md`.

## Stop

Stop the current phase when cycle identity is ambiguous, the Issue snapshot
changes during Requirements, an upstream artifact or selected rule graph is
invalid, a phase contract cannot be satisfied without changing an upstream
decision, required authority is missing, or a validation gate fails after
in-scope correction attempts. Apply the Goal terminal rule above; do not start
another phase or Learn while the Goal remains unfinished.

The full-cycle request requires `create_goal`, `get_goal`, and `update_goal`.
When one is unavailable, report the missing capability and do not claim that
the cycle ran. A text-only phase draft is allowed only when explicitly
requested.

## Finish

After Ship is confirmed complete, end the invocation. Report the completed
phase sequence, artifact and verification evidence, delivery state, and any
residual risk. Learn is a separate user-invoked action.
