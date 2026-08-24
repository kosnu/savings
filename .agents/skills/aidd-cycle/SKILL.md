---
name: aidd-cycle
description: Run one complete repository AI Driven Development cycle in a single invocation by setting, executing, and completing one phase Goal at a time according to the repository workflow. Use when the user asks to run or start an AIDD cycle or wants the full cycle completed end to end. Resume only when the same cycle is identifiable; otherwise start a new cycle from the workflow-defined entry phase.
---

# AIDD Cycle

Run the repository AIDD workflow end to end. This skill owns cycle identity,
phase transitions, Goal orchestration, and completion confirmation.
`goal-setting` owns construction of one phase Goal. The parent orchestrator is
the sole owner of Goal lifecycle operations. The executor assigned below owns
only the delegated phase work and returns evidence to the parent.

## Read First

- `docs/ai-driven-development/workflow.md`
- `docs/ai-driven-development/issue-guidelines.md`
- `.agents/skills/goal-setting/SKILL.md`
- `docs/harness/rule-map.json`
- `references/artifact-validation.md` when entering Requirements, Design, or Build
- `.codex/config.toml` and the selected phase agent file before delegation

The workflow is canonical. Do not add phase rules here or infer a phase from an
artifact's mere existence.

## Establish the Cycle

1. Call `get_goal` before `create_goal`.
2. If an unfinished Goal belongs to another task, preserve it and stop.
3. If an unfinished Goal belongs to this cycle, continue that Goal. A paused
   Goal is user- or system-owned state; report it and wait for resume instead of
   inventing a resume action.
4. Otherwise fetch the latest Issue title, body, canonical URL, and `updatedAt`.
   The exact body is the cycle's only Task Context; the title is workspace
   identity input and is recorded once in the Requirements typed source.
5. Resolve one workspace for the Issue with the workspace validator. Reuse its
   sole existing result, or use the validator's deterministic Issue-title-derived
   result when none exists; stop when more than one exists.
6. Record the Issue identity, exact cycle-start title, body SHA-256, and
   workspace in the Requirements Goal. Design identifies that cycle through
   the validated canonical Requirements path and SHA-256. Build and Ship use
   the Design completion receipt and its upstream hashes. Never retype or
   accept another cycle title after Requirements.

Conversation, review comments, current diffs, prior artifacts, and newly
changed rules may explain execution or trigger a Stop, but cannot extend the
Requirements Task Context. Prior canonical artifacts are continuity baselines,
not additional requirements.

## Run the State Machine

For each phase in the workflow:

1. Reconfirm the current Goal state and the preceding phase's completion
   evidence.
2. Apply the `goal-setting` construction procedure to set exactly the current
   phase Goal. Before `create_goal`, that procedure runs the phase entry checks
   from `references/artifact-validation.md`: Requirements and Design validate
   their temporary Goal input; Build revalidates both canonical upstream
   artifacts and generated displays against the current Issue snapshot and the
   Design completion receipt.
3. Execute only that Goal under its Context Packet and selected rule-map
   subgraph, using the phase executor assigned below. In Design, record the
   complete schema-v3 target state: final product behaviors, verification
   cases, normalized ownership scopes, and all final machine-addressable
   representations. Automated verification cases own shell-free command
   argument arrays; manual cases own concrete procedures. Derive machine review surfaces and path rules from the
   union of target paths and the current owned baseline, including paths that
   disappear in the target. In Build, reconstruct exactly that target state in
   the ownership scopes, record every verification result, and run the Build
   rule coverage validator against both the final owned tree and actual Git
   diff. Stop on missing or extra owned representations, failed or missing
   verification evidence, out-of-scope changes, undeclared surfaces, a surface
   or path rule absent from the receipt, or a governed path with no routing
   surface.
4. For Requirements and Design, retain the validated temporary Goal JSON and
   run the artifact gates before completing the phase. After the Design gates
   succeed, capture the canonical Design completion receipt and record its path
   and SHA-256 in the phase completion evidence.
5. For Build, immediately before completion, run the Build rule coverage
   validator, then rerun the Build Entry gate with the receipt path and SHA-256
   recorded by Design and require it to print that same SHA-256. Only after
   these phase-specific checks and the objective, Done
   conditions, and Verification are satisfied, the parent calls
   `update_goal(status: complete)` and confirms the terminal state with
   `get_goal` before advancing.
6. While useful progress remains possible, keep the Goal active. The parent calls
   `update_goal(status: blocked)` only after the same blocking condition has
   recurred for at least three consecutive Goal turns and no in-scope path can
   make progress; confirm the terminal state and end the cycle invocation.

Never have two phase Goals active at once. Never advance because files exist,
tests happened to pass, or a phase draft was produced.

## Phase Execution Assignment

The parent agent remains the cycle orchestrator and keeps its currently
selected model and reasoning effort. Assign each phase exactly as follows:

| Phase | Executor | Configuration |
| --- | --- | --- |
| Requirements | `aidd-requirements-design` | `.codex/agents/aidd-requirements-design.toml` |
| Design | `aidd-requirements-design` | `.codex/agents/aidd-requirements-design.toml` |
| Build | `aidd-build` | `.codex/agents/aidd-build.toml` |
| Ship | parent agent | current selection |

For Requirements, Design, and Build:

1. The parent sets or identifies the one active phase Goal before delegation
   and remains its sole lifecycle owner. Only the parent calls `create_goal`,
   `get_goal`, or `update_goal`; these operations are not delegated.
2. Call `spawn_agent` exactly once with `agent_type` set to the table's exact
   Executor value, `fork_turns` set to `"none"`, and a separate
   lowercase-underscore `task_name` such as `aidd_requirements`, `aidd_design`,
   or `aidd_build`. A custom `agent_type` cannot use the default full-history
   fork; the self-contained `message` below replaces inherited conversation
   context. `agent_type` selects the registered project-scoped agent; never use
   `task_name` as the executor selector. The selected configuration file,
   registered by `.codex/config.toml`, is the source of truth for its model,
   reasoning effort, and phase instructions; do not override those settings at
   the call site. Sandbox and approval settings follow the parent turn's active
   runtime policy.
3. Give the phase agent a self-contained `message` containing the repository
   root, current branch, phase, a copy of the active Goal identity and Context
   Packet,
   required workflow and validation references, upstream artifact or receipt
   identity, read/write boundary, Verification, and Stop conditions.
   This message is the phase execution contract; it does not transfer Goal
   lifecycle state or authority to the phase agent.
4. The phase agent executes only the delegated phase contract. It must not call
   Goal lifecycle tools, create the next Goal, start another phase, run Learn,
   or delegate further. It returns exact artifact paths and hashes, commands and
   results, and any Stop finding to the parent without claiming Goal completion.
5. Wait for the phase agent before doing more phase work. Reuse that agent for
   same-phase continuation when possible, and never run two phase executors at
   once. If the user or system pauses, replaces, or ends the active Goal while
   the phase agent is running, interrupt the agent, preserve any worktree
   changes for inspection, do not accept its evidence or update the Goal, and
   stop.
6. After the phase agent finishes, the parent first calls `get_goal` and requires
   the same phase Goal to remain active. The parent then independently inspects
   the owned changes and reruns every Verification command recorded in the Goal
   and every required phase gate instead of treating the agent's report as
   authoritative. The parent alone decides whether the objective, Done
   conditions, Verification, or terminal blocking rule is satisfied and
   performs the corresponding Goal update. Advance only after the parent calls
   `get_goal` again and confirms terminal `complete`; otherwise continue or stop
   under the existing Goal rules.

If the registered phase agent or its configured model and reasoning effort is
unavailable, preserve the active Goal and stop. Do not inherit, substitute, or
silently run the delegated phase in the parent.

## Artifact Boundary

- `requirements.json` and `design-doc.json` are machine sources of truth.
- `requirements.md` and `design-doc.md` are deterministic display outputs.
- Requirements owns only the Requirements pair; Design owns only the Design
  pair; later phases treat both pairs as read-only.
- Requirements alone owns `cycle_start_issue_title`. Its Goal and artifact must
  exactly match the fetched title. Design derives cycle identity from the
  validated Requirements bytes, and the receipt carries that owned value into
  Build and Ship; no later phase accepts a title argument.
- Every regenerated artifact covers its complete upstream input. New cycles use
  schema v3; schema v2 is history/baseline input only and cannot complete a new
  phase, produce a receipt, or enter Build.
- Semantic identity lives in typed IDs, statuses, owners, roles, hashes, and
  references. Current validators also enforce canonical headings, substantive
  text, and unambiguous evidence mapping as artifact format gates; follow those
  gates from `references/artifact-validation.md`.
- Design `target_state` is the only completed-state source of truth. It contains
  final product behaviors, verification cases, ownership scopes, and
  representations, never an add/change/remove list. Requirement content remains
  only in canonical `requirements.json`. Selected rules constrain Requirements
  and Design; they never define product behavior directly or substitute for a
  missing Requirement. Build consumes the receipt target state and removes any
  owned baseline impurity by making the final state match it; no explicit
  deletion record is required.

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
