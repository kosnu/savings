---
name: goal-setting
description: Set a Codex Goal from the repository AI Driven Development templates for Intent / Requirements, Design / Plan, Build / Verify, or Ship. Use when the user asks to set up a Goal, says 次のGoal, or names a phase such as requirements, design, build, or ship. For learning from review feedback or preparing the next Requirements input, use the learn skill first. If Goal tools are unavailable or the user explicitly asks for text only, prepare a ready-to-set Goal input instead.
---

# Goal Setting

## Purpose

Set the next Codex Goal with the Goal tool.

Do not execute the Goal's implementation work. Do not write the target artifact unless the user separately asks for that. The configured Goal text must be self-contained because Goal execution starts from that text.

If `create_goal` is available and the user asked to set a Goal, call it with the prepared Goal text as the objective. Return only a concise confirmation after the tool succeeds. Do not print the full Goal body unless the user asks to see it.

If Goal tools are unavailable, or the user explicitly asks for a draft, pasteable input, or review before setting, return the prepared Goal in Markdown instead of calling a tool.

## Supported Phases

Accept these phase names:

- `intent`, `requirements`, `prd`: Intent / Requirements Goal
- `design`, `plan`: Design / Plan Goal
- `build`, `verify`: Build / Verify Goal
- `ship`: Ship Goal
- `next`: infer the next phase from available artifacts and current branch context

If the user does not provide a phase, infer `next` only when the current context is clear. Otherwise ask one short clarification question.

## Required Repository Templates

Read the matching template before drafting the Goal:

- `docs/ai-driven-development/goal-templates/intent-requirements-goal.md`
- `docs/ai-driven-development/goal-templates/design-plan-goal.md`
- `docs/ai-driven-development/goal-templates/build-verify-goal.md`
- `docs/ai-driven-development/goal-templates/ship-goal.md`

Also read these harness docs before deciding additional references:

- `docs/ai-driven-development/workflow.md`
- `docs/ai-driven-development/issue-guidelines.md`
- `docs/harness/rule-map.json`

Use `docs/harness/rule-map.json` to select any additional policy, domain, ADR, design, or app-specific documents. Classify the requested Goal by `path`, `domain`, `activity`, and `topic`, then include the selected document subgraph in the Goal-setting input.

For non-trivial Goals, prepare a compact Context Packet instead of copied document bodies or long discovery notes. The Context Packet is the executor's first-read input and must contain only scope, selected references, constraints, known risks, stop checks, and verification expectations.

The templates are checklists for required content, not output skeletons. Do not copy the template body into the configured Goal. Produce the shortest self-contained Goal that preserves the requested phase, target artifact, scope, constraints, required inputs, Done, Verification, and Stop conditions.

## Context Discovery

Use the smallest useful discovery set for the requested phase:

- Current branch: `git branch --show-current`
- Local state: `git status --short`
- Existing workspace artifacts: `docs/ai-driven-development/workspaces/**/requirements.md` and `design.md`
- Current PR when needed: `gh pr view --json number,title,url,baseRefName,headRefName,state,isDraft,body`
- Issue input when provided: `gh issue view <number or URL>`
- Review comments when requested or when generating Ship Goals: thread-aware GitHub review data

Do not make unrelated repository changes while generating a Goal.

Do not inspect implementation files while setting Goals unless the requested phase is Design / Plan or Build / Verify and the Goal explicitly needs implementation references. When creating a new cycle from review feedback, do not inspect implementation files.

## Cycle Input Rules

A new cycle always starts from Intent / Requirements.

When review comments, verification findings, operational findings, policy changes, or rule changes exist, do not set a continuation Goal from Design / Plan or Build / Verify by default. Use `$learn` first to decide how the next Requirements initial input, rules, policies, or oversight constraints should change.

Allowed inputs for the next Requirements Goal:

- Original Issue or initial input.
- Review comments or verification findings.
- Changed rules or policies.
- Explicit oversight constraints from the user.

Forbidden inputs for the next Requirements or Design Goal:

- Previous implementation code.
- Previous UI behavior.
- Current diff shape.
- Previous implementation-specific design choices.
- Assumptions derived from how the previous implementation happened to work.

Build / Verify may later change existing code, but the Goal must be driven by the newly produced Requirements and Design, not by patching the previous implementation directly.

## Phase Rules

### Rule Selection

- Include `docs/harness/rule-map.json` in every non-trivial Goal that may touch documented behavior, policies, domain rules, ADRs, design decisions, or app-specific guidance.
- Do not copy all docs into the Goal. Add only the selected subgraph and the reason each selected document applies.
- For each selected rule-map entry, include `id`, `file`, and a concise selection reason in the Goal inputs.
- When the selected rule-map entry has `depends_on`, include those prerequisite documents with `id`, `file`, and a concise reason in the Goal inputs.
- When `overrides` or `priority` is used to resolve competing entries, include the conflict decision in the Goal inputs.
- If rule-map selection is ambiguous, add a Stop condition requiring the executor to clarify the applicable document subgraph before implementation.

### Intent / Requirements

- Treat Issue content as input, not final requirements.
- Require the Goal to check that the Requirements / PRD does not expand beyond the intent, constraints, out-of-scope items, and success criteria present in the Issue, oversight inputs, and selected documents.
- Preserve the artifact premise: use the PRD title, Goal, and Issue summary to determine whether a capability is existing behavior or a future capability being introduced.
- Do not describe future capabilities, states, workflows, UI, APIs, or data models as current behavior.
- Put current facts and current gaps in Background / Current State; put desired future behavior in Scope, Functional Requirements, Acceptance Criteria, or Q&A.
- Keep implementation, Design Doc creation, and PR creation out of scope.
- Prefer output path `docs/ai-driven-development/workspaces/<issue-number-or-topic>/requirements.md`.
- If domain values appear in UI, require the PRD to state what the user wants to judge with each value, using `Domain Value Intent`.
- Do not turn the domain value purpose into a fixed UI layout, display order, or component choice in Requirements / PRD.
- If user-visible text or feedback matters, require the PRD to state what the user must understand, not the final copy.
- Include a Done item requiring added Requirements / PRD text to be checked against the artifact premise.
- Include a Done item requiring the Requirements / PRD to be checked against Issue and oversight inputs for unintended scope expansion.
- Include a Done item requiring Background / Current State not to describe future behavior as already available.
- Include a Done item requiring UI domain values to have an explicit purpose when they appear.
- Add a Stop condition when a requirement or success condition cannot be traced to the Issue, oversight inputs, or selected documents.

### Design / Plan

- Use the latest Requirements / PRD as the source of truth.
- Do not implement.
- Require the Design / Plan to preserve the Requirements / PRD intent, constraints, out-of-scope items, and acceptance criteria without adding product scope.
- Include output path for `design.md` in the same workspace as the Requirements / PRD unless the user specifies another path.
- If domain values appear in UI, require `Domain Value UI Decisions` to map each value purpose to the primary thing shown: value, judgment result, state, breakdown, or identity.
- Require Design / Plan to decide whether comparison sources, baselines, allowed ranges, categories, or periods should be shown as main information or supporting context.
- Use the rule-map selected Web UI policies for typography, lists, spacing, button variants, forms, overlays, responsive behavior, and domain UI decisions.
- Ensure user-visible major copy is decided in the Design Doc.
- If multiple data changes are involved, include the transaction boundary policy selected by `docs/harness/rule-map.json` and require transaction boundary / operation boundary decisions.
- Add a Stop condition when the Design / Plan would need to introduce product decisions, target features, or success criteria that are not in the Requirements / PRD.

### Build / Verify

- Use the latest Requirements / PRD and Design Doc as constraints.
- Require the implementation to stay within the Requirements / PRD and Design Doc and to stop instead of filling in missing product scope.
- Include verification only for affected runtime, build, type, or DB behavior. For Web app changes, prefer the compact form `AGENTS.md の Web verification batch` instead of copying the full command list. Mention Storybook verification only when the change affects `browser-test` tagged stories, `apps/web/.storybook-test/`, or Storybook browser-test configuration.
- If review comments are the trigger, require classification before implementation.
- Stop if the comment belongs upstream to Requirements / PRD, Design Doc, or policy.
- Do not let Build invent major user-visible copy that the Design Doc has not decided.
- Stop if implementation would require expanding the interpretation of Requirements / PRD or Design Doc.

### Ship

- Use the current implementation branch, PRD, Design Doc, verification results, related Issue, and related PR.
- Include PR body update, residual risk, review replies, and thread resolve decisions.
- Include review thread replies and resolving only fully completed threads when review comments were handled.
- Do not create next-cycle inputs, knowledge decisions, or Requirements changes in Ship.

## Goal Budget

The configured Goal text must be 3800 characters or less, including any note before the Markdown Goal.

This is a hard response gate, not a best-effort target. Draft for 3400 characters or less so final edits have room. Before returning the Goal, measure the exact character count of the full response text. If tooling is available, write the candidate response to a temporary file outside the repository and run `wc -m` against that file. Do not rely on approximate token counts or visual length.

When the draft would exceed 3800 characters:

- Keep the Goal self-contained, but compress wording before returning it.
- Prefer paths, issue or PR numbers, and concise evidence summaries over copied source text.
- Keep only the selected rule-map subgraph and one short reason per document.
- Collapse long discovery notes, Q&A, risks, subagent instructions, and verification details into short bullets.
- Replace long verification command lists with a pointer to the applicable repository verification section when the executor will have the same repository instructions.
- Omit optional background, alternatives, and explanation that are not needed to execute the Goal.
- Merge repeated constraints into one bullet when they point to the same boundary.
- Replace template checklist wording with phase-specific done checks that are traceable to the current request.
- Do not omit phase, target artifact path, scope, constraints, required inputs, Done, Verification, or Stop sections.
- After compression, measure the full response text again. Repeat until it is 3800 characters or less.
- If the Goal still cannot fit within 3800 characters without losing required execution context, return a concise note naming the missing compression decision instead of producing an oversized Goal.

## Token Budget

Prefer references over copied content, and avoid forcing the executor to rediscover context.

- For non-trivial Goals, pass a compact Context Packet before detailed phase instructions.
- Build the Context Packet from deterministic selection first: `docs/harness/rule-map.json`, Markdown front matter, path, issue or PR number, branch context, and targeted `rg` results.
- Pass paths, issue numbers, PR numbers, current branch, and selected rule-map entries instead of copying full document bodies.
- Include the selected rule-map subgraph and concise selection reasons, not the full rule-map contents.
- Tell the executor to read the provided references first and avoid broad searches unless the references conflict, are insufficient, or trigger a Stop condition.
- Do not include unrelated workspace artifacts, old PR notes, or long command output in the configured Goal.
- For small docs-only, one-file, or already-scoped changes, prepare one compact Goal instead of forcing the full workflow.
- Keep verification commands concrete, but do not include historical verification logs unless they are directly required.
- Keep Context Packet content short enough that the executor can start from it without re-reading broad docs. Prefer 1000 to 1500 characters for the packet when practical.

## Context Packet Shape

Use this shape when the Goal is non-trivial:

- Scope: target artifact, in-scope work, out-of-scope work.
- Selected refs: file paths, rule-map IDs, and one short reason per reference.
- Constraints: issue, PRD, Design Doc, policy, and domain boundaries.
- Known risks: only risks that affect scope, design, verification, or Stop decisions.
- Stop checks: conditions that require clarification before continuing.
- Verification expectations: affected app or docs-only verification scope.

## Scout Agent Use

Prefer the project-scoped `context-scout` custom agent with `$context-scout` for bounded discovery and summarization before the main executor makes scope, design, or edit decisions.

- Use deterministic selection before Scout work when possible.
- Use the Scout Agent for rule-map candidate selection, front matter scanning, related docs discovery, existing-pattern summaries, affected-file discovery, upstream scope checks, or verification-failure summaries.
- Require Scout output to be concise findings with file references, not raw document bodies, copied source text, or long logs.
- Require the main executor to reduce Scout findings into the Context Packet before making the main decision.
- Do not use Scout for product scope decisions, final design decisions, file edits, GitHub writes, or ambiguous Stop-condition judgments.
- Do not add Scout instructions to small one-file, docs-only, or already-scoped Goals when direct execution is cheaper.

## Output

When `create_goal` succeeds, return only:

1. A concise note if required inputs are missing or ambiguous.
2. A concise confirmation that the Goal was set, including phase and main target.

When Goal tools are unavailable or the user requested text only, return only:

1. A concise note if required inputs are missing or ambiguous.
2. A ready-to-set Codex Goal in Markdown.

Do not include a long explanation. Do not list alternatives unless the user asks.

## Stop

Stop before producing a Goal when:

- The requested phase cannot be determined.
- Required upstream artifact paths are missing and cannot be inferred.
- The target Issue, PR, branch, or workspace is ambiguous.
- The requested Goal would need to ignore a user constraint.
- Review comment handling cannot be tied to the current branch, current diff, or recent commits.
