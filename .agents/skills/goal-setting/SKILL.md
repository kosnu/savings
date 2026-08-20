---
name: goal-setting
description: Set exactly one Codex Goal from the repository AI Driven Development workflow and matching phase template. Use when the user asks to set a Goal, says 次のGoal, or names requirements, design, build, verify, or ship. This skill prepares and sets the Goal but does not execute it. If Goal tools are unavailable or the user requests text only, return a ready-to-set Goal instead.
---

# Goal Setting

Construct and set exactly one AIDD phase Goal. Do not execute the Goal, edit
repository files, or create its artifact.

## Read First

1. `docs/ai-driven-development/workflow.md`
2. The matching file under `docs/ai-driven-development/goal-templates/`
3. `docs/ai-driven-development/issue-guidelines.md` for Requirements
4. `docs/harness/rule-map.json` and the smallest applicable subgraph
5. `.agents/skills/aidd-cycle/references/artifact-validation.md` for
   Requirements or Design

The workflow defines phase order and contracts. Templates are construction
checklists only.

## Select the Phase

- Call `get_goal` before selecting a phase.
- Use the phase explicitly requested by the user when it is compatible with the
  workflow.
- Otherwise use verified terminal Goal state: a new cycle starts at
  Requirements; each later phase requires the immediately preceding Goal to be
  complete.
- Artifact existence, current diffs, branch names, or tests do not authorize
  skipping a phase.
- Return control to `aidd-cycle` when the same-cycle phase Goal is already
  unfinished. Stop when another task owns the unfinished Goal.

## Construct the Goal

Create one compact Context Packet containing:

- objective and current phase;
- cycle, Issue, workspace, branch, and artifact identity needed by the phase;
- complete upstream scope and read/write boundaries;
- selected rule-map nodes with reasons;
- explicit user constraints and known risks;
- phase Done, Verification, and Stop conditions.

Every condition must trace to the workflow, the matching template, an
applicable repository rule, or an explicit user constraint. Do not paste
discovery logs or restate the workflow.

For Requirements:

- fetch and snapshot the latest Issue body; it is the only Task Context;
- select direct rule-map nodes from Issue-supported classifications, then add
  their declared dependency closure;
- resolve the Git `HEAD` Requirements baseline and classify every baseline and
  current requirement/section transition;
- create and validate a temporary `requirements_goal` JSON before setting the
  Goal.

For Design:

- require the canonical Requirements artifact gates to pass again;
- cover every current requirement ID and every Git `HEAD` Design baseline
  section;
- create and validate a temporary `design_goal` JSON before setting the Goal.

Typed IDs and references define ownership. Reject missing records, invalid
owners, broken dependency edges, stale hashes, incomplete inventories, and any
schema-v2 text or evidence condition reported by the phase validators.

Requirements and Design Goal JSON must include the phase contract IDs defined
by the workflow in its canonical order and with its canonical text. Add
task-specific entries only after the required entries and give each a stable ID.

## Set and Return

Keep the complete Goal text at most 3800 characters. Preserve objective, scope,
constraints, inputs, Done, Verification, and Stop before compressing optional
context.

Call `create_goal` once. Do not set `token_budget` unless the user explicitly
requested one. On success, return a concise confirmation naming the phase and
target; in orchestrated use, return control to `aidd-cycle`.

If `create_goal` is unavailable or the user explicitly requests text only,
return one ready-to-set Goal and do not claim it was set.

Stop before setting when phase identity is unresolved, a required upstream
phase is not confirmed complete, the Issue or workspace is ambiguous, a
Requirements or Design gate fails, the rule subgraph is unresolved, a user
constraint conflicts with the phase contract, or the Goal cannot fit without
losing required context.
