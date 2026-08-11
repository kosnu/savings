---
name: goal-setting
description: Set exactly one Codex Goal from the repository AI Driven Development workflow and matching phase template. Use when the user asks to set a Goal, says 次のGoal, or names requirements, design, build, verify, or ship. This skill prepares and sets the Goal but does not execute it. If Goal tools are unavailable or the user requests text only, return a ready-to-set Goal instead.
---

# Goal Setting

## Purpose

Set exactly one self-contained Codex Goal. Do not execute the Goal or create its
target artifact.

When called by `.agents/skills/aidd-cycle/SKILL.md`, construct and set one phase
Goal, then return control to `aidd-cycle`.

## Canonical Sources

Read `docs/ai-driven-development/workflow.md` first. It is the source of truth
for phase order, phase responsibilities, upstream artifact boundaries, Done,
Verification, Stop conditions, and the relationship between Ship and Learn.
Do not restate or reinterpret those rules in this skill.

Then read:

- the matching file under `docs/ai-driven-development/goal-templates/`
- `docs/ai-driven-development/issue-guidelines.md` when Issue input is involved
- `docs/harness/rule-map.json` and the smallest selected document subgraph

Treat Goal templates as construction checklists, not as a second workflow
definition and not as output skeletons.

## Procedure

1. Determine the requested phase or the next phase from the canonical workflow,
   current Goal state, workspace artifacts, branch, Issue, and PR context. A
   named phase does not override the workflow. If the phase is unclear, ask one
   short clarification question. An unfinished same-cycle phase Goal remains
   owned by `aidd-cycle`, so return control to it.
2. Read the matching Goal template and only the references needed for that
   phase. Use `rule-map.json` to select documented policies, domain rules, ADRs,
   designs, and app guidance.
3. Use the smallest useful discovery set. Start with `git branch --show-current`,
   `git status --short`, existing workspace artifacts, and the supplied Issue or
   PR. Fetch thread-aware review data for Ship when needed. Inspect implementation
   files only when Design / Plan or Build / Verify needs them.
   For Intent / Requirements, fetch the latest Issue body, URL, and `updatedAt`.
   The exact Issue body is the only Task Context. Conversation, review, current
   diff, previous artifacts, and recently changed rules may not extend it. When
   the phase belongs to an Issue-based AIDD cycle, require the workspace
   validator from `aidd-cycle` to succeed before constructing the Goal. Reuse
   the Issue's only existing workspace; never invent a versioned or retry
   directory for a new cycle.
4. Build a compact Context Packet containing scope, selected references and
   reasons, constraints, known risks, Stop checks, and verification expectations.
   Preserve every requirement from the workflow and matching template without
   copying their full text. Every Done, Verification, and Stop condition must be
   traceable to the workflow, matching template, selected repository rules, or
   an explicit user constraint.
5. For Requirements and Design, serialize that packet and the structured gates
   as `requirements_goal` or `design_goal` JSON, validate the JSON, and render
   `display.markdown` for the Goal objective. The renderer must reject the
   objective unless its Context Packet keeps Goal, constraints, Stop, and
   Done / Verification markers and its Gate and per-ID or baseline scope content
   matches the structured validation fields. The renderer adds a canonical
   Validated Scope line from every structured ID and rejects objective text that
   narrows execution to the current delta. The JSON is retained as the
   comparison source until the phase artifact passes; Goal Markdown is not a
   phase validator input.
6. Set the Goal with `create_goal`. In orchestrated use, include the
   workflow-defined cycle identity, phase inputs, artifact references, and
   current phase supplied by `aidd-cycle`. Keep cycle control and next-Goal
   creation in `aidd-cycle`.

## Intent / Requirements Provenance

For an Intent / Requirements Goal:

- Select each direct rule-map node from Issue evidence and an exact
  `applies_to` field/value match. The normalized `match.value` must occur in the
  Issue evidence; translation, aliases, and `reason` are not evidence. Record
  the evidence, match, and reason. Select at least one direct node; an empty
  `direct_rules` array is never a valid fallback.
- Add the complete transitive dependency closure through declared `depends_on`
  edges. Each non-direct dependency appears once and names a selected `via`
  node with a declared edge.
- Do not select implementation, test, fixture, mock, or app policies because a
  surface appears in conversation, the current diff, a previous artifact, or a
  recently updated rule. Defer those policies to Design / Plan or Build /
  Verify unless the Issue explicitly names that surface.
- Do not turn an implementation policy into a product requirement, acceptance
  criterion, or Q&A decision.
- Include the exact `Requirements Input Gate` JSON block from the matching Goal
  template. Before `create_goal`, validate it with the command defined in
  `.agents/skills/aidd-cycle/SKILL.md`. The validator must receive the repository
  root and reject any `--rule-map` other than the non-symlink canonical
  `docs/harness/rule-map.json` path.
- Treat a new-cycle `requirements.json` as a complete replacement for the current
  Issue, not a document for only the new or changed Issue fragment. Resolve the
  previous canonical Requirements from Git `HEAD`; do not let the Goal author
  choose whether a baseline exists or which file is the baseline.
- Include the exact `Requirements Completeness Gate` JSON block. Classify every
  previous requirement item and required section as unchanged, changed, or
  retired, and every added item as new. Changed and new entries require exact
  current-Issue evidence. Retirement evidence must name the ID and explicitly
  retire it without negating that decision. Each changed or new requirement's
  exact Issue evidence must occur in that requirement definition and may not
  map to another requirement. Include substantive definitions for
  every resulting ID in `validation.requirements`. Require every canonical
  section in generated `requirements.json` to use its own structured entry.
  Each changed or new section's evidence must occur in that entry and
  may not map to another section. Validate the proposed Goal with
  the `--kind goal` command.
- Preserve the exact validated Goal until artifact completion. Require the
  artifact forms of both Requirements gates to equal the corresponding parsed
  Goal Gate objects; independent validity is not sufficient.
- Treat validator string presence as a structural gate only. Stop when the Issue
  evidence does not unambiguously justify its specific changed, new, or retired
  item or section.

If user oversight changes intent, scope, constraints, or success criteria,
stop before creating the Goal until the target Issue body is updated and
refetched. Oversight may clarify execution or trigger a Stop without becoming
an unrecorded Requirements input.

## Generated Artifact Completeness

The Requirements continuity gate and Design coverage gate are phase-specific
enforcement of one invariant: every regenerated canonical document is a
complete replacement for its current upstream input. Deltas describe change;
they do not define Goal or artifact scope.

### Design / Plan Coverage

For a Design / Plan Goal:

- Require the current canonical workspace `requirements.json` to have passed both
  Requirements artifact gates. Reject a caller-supplied copy, temporary path,
  or symlink alias; do not construct Design from a locally narrowed upstream
  artifact.
- Treat the complete current `requirements.json` as the Goal scope. A requirement
  added in the current cycle is a delta to integrate, not permission to design
  only that requirement.
- Calculate the Requirements SHA-256 and collect every stable `FR-*`, `NFR-*`,
  and `AC-*` identifier. Include one separate substantive design and
  verification scope entry for every ID in the template's Design Coverage
  Gate. Each scope entry must contain only its target ID; grouped or
  generic coverage is invalid.
- Before `create_goal`, validate the Goal with the `--kind goal` command defined
  in `.agents/skills/aidd-cycle/SKILL.md`.
- Resolve the committed previous-cycle `design.json` from the canonical workspace
  path in Git `HEAD`, not from a caller-supplied file. Require every prior
  structured section to have its own heading-bearing `validation.baseline_scopes`
  entry in the Goal JSON, then be classified as exact-content preserved or explicitly
  replaced with heading-bearing evidence in the new Design JSON.
- Require the output `design.json` to resolve every identifier through design
  and verification evidence in a unique entry that contains only that
  identifier. Each ID gets its own entry; omission, grouping, and generic
  shared evidence are invalid.
- Stop when ID-bearing or heading-bearing evidence is structurally valid but
  does not actually resolve that specific requirement or prior section.

Before setting a Build / Verify Goal, require the current `requirements.json`
and `design.json` to pass their artifact completeness commands and require
renderer checks for `requirements.md` and `design-doc.md`. Do not treat
existing files or completed phase Goals alone as evidence that the complete
upstream inputs remain covered.

Do not edit repository files or create a git diff while preparing the Goal.

## Goal Budget

The complete Goal text must be at most 3800 characters. Draft below 3400
characters when practical and measure the exact character count before setting
or returning it. Compress discovery notes and repeated wording before removing
phase, target, scope, constraints, required inputs, Done, Verification, or Stop
content.

## Tool Fallback and Output

When `create_goal` succeeds, return only a concise confirmation naming the phase
and main target. In orchestrated use, return that control directly to
`aidd-cycle` instead of ending the overall invocation.

If Goal tools are unavailable, or the user explicitly requests a draft or text
only, return one ready-to-set Markdown Goal and do not claim that it was set.

## Stop

Stop before producing a Goal when the canonical workflow cannot determine the
phase, required upstream inputs are missing, the target Issue, PR, branch, or
workspace is ambiguous, workspace identity validation fails, the latest Issue
body cannot be fetched, the
Requirements Input Gate fails, a user constraint would be ignored, the
Requirements Completeness Gate fails, the selected rule-map subgraph is
unresolved, the Design Coverage Gate fails, or the Goal cannot fit the character
budget without losing required execution context.
