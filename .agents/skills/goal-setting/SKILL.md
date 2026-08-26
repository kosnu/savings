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
   Requirements, Design, or Build

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

For Requirements, run the workspace validator with the latest Issue title and
use the workspace it prints. Store that exact title in
`validation.cycle_start_issue_title` in the temporary Requirements Goal JSON.
For every later phase, use the validated canonical Requirements bytes or the
Design completion receipt as cycle identity. Do not refetch, retype, copy from
Goal prose, or accept a caller-supplied cycle title. Do not supply or construct
a workspace candidate outside the validator.

For Requirements:

- fetch the latest Issue title and snapshot the latest body; the body is the
  only Task Context and the exact title is the Requirements-owned typed cycle
  identity and workspace derivation input;
- select direct rule-map nodes only when their path, domain, activity, or topic
  has literal evidence in the Issue body, then add their declared dependency
  closure; do not encode later implementation terminology into Requirements;
- resolve the Git `HEAD` Requirements baseline and classify every baseline and
  current requirement/section transition;
- create and validate a schema-v3 temporary `requirements_goal` JSON before
  setting the Goal. A schema-v2 artifact may be inspected only as a Git
  continuity baseline and cannot be retained as the current Goal or artifact.

For Design:

- require the canonical Requirements artifact gates to pass again;
- derive the cycle-start title only from the validated canonical Requirements
  source and bind Design to those Requirements bytes by path and SHA-256;
- cover every current requirement ID and every Git `HEAD` Design baseline
  section;
- define schema-v3 `target_state` as the only completed-state source of truth:
  all final product behaviors, all final verification cases with an automated
  direct argv command whose executable is in the repository allowlist (`pnpm`,
  Python 3, `node`, `git`, or `jq`) or a substantive manual procedure, normalized
  non-overlapping `file` or `tree` ownership scopes, and every final
  machine-addressable implementation/test/Story/fixture/configuration/
  migration/documentation representation. Story locators inventory runtime
  named exports and reject default, type-only, `const enum`, import/source-backed,
  and wildcard re-exports; test
  locators require nonalias named imports from the approved runner. Do not encode add/change/remove
  operations. Requirement content remains only in canonical
  `requirements.json`, and every behavior, verification case, and
  representation must retain its required Requirement references;
- inventory the paths currently present in the ownership scopes and derive
  rule coverage from their union with target representation paths. Record the
  exact canonical `implementation_surfaces` and all Design-specific or
  path-specific `additional_rules`, including rules selected only because a
  baseline representation will be absent from the target. The validator adds
  Requirements-selected rules and dependency closure;
- create and validate a temporary `design_goal` JSON before setting the Goal.

For Build:

- obtain the canonical Design completion receipt path and SHA-256 from the
  preceding Design Goal completion evidence;
- fetch the current Issue snapshot and run the Build Entry gate against that
  receipt;
- record the verified receipt path, unchanged SHA-256, and its complete
  target-state, owned-baseline, artifact, and selected-rule identity in the
  Build Goal;
- require Build to materialize exactly the receipt target state inside the
  ownership scopes, not to append a delta to the baseline. Require canonical,
  case-type-specific `.aidd/build-verification.json` evidence for every target
  verification case, generated by the repository verification runner and bound
  to the current final-state hash. The coverage validator validates command
  identity, exit code, output hash, generator, and final-state identity without
  executing an artifact-provided command;
- require the Build rule coverage validator at completion. It rejects missing
  target representations, unregistered owned paths/exports/test cases,
  out-of-scope changes, failed or missing verification evidence, undeclared
  surfaces, missing receipt rules, and governed paths without a routing
  surface, then writes canonical final-state and per-path Coverage evidence;
- take the cycle-start title only from the verified receipt; the Build entry
  command has no title input.

Typed IDs and references define ownership. Reject missing records, invalid
owners, broken dependency edges, stale hashes, incomplete inventories, and any
schema-v3 format condition reported by the phase validators. Accept schema-v2
sources only for historical rendering or Git-baseline continuity; never promote
them into a new Goal, receipt, or Build.

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
required phase entry gate fails, the rule subgraph is unresolved, a user
constraint conflicts with the phase contract, or the Goal cannot fit without
losing required context.
