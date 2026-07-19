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
   short clarification question.
2. Read the matching Goal template and only the references needed for that
   phase. Use `rule-map.json` to select documented policies, domain rules, ADRs,
   designs, and app guidance.
3. Use the smallest useful discovery set. Start with `git branch --show-current`,
   `git status --short`, existing workspace artifacts, and the supplied Issue or
   PR. Fetch thread-aware review data for Ship when needed. Inspect implementation
   files only when Design / Plan or Build / Verify needs them.
4. Build a compact Context Packet containing scope, selected references and
   reasons, constraints, known risks, Stop checks, and verification expectations.
   Preserve every requirement from the workflow and matching template without
   copying their full text.
5. Set the Goal with `create_goal`. In orchestrated use, include the cycle ID,
   workspace, initial input, artifact lineage, and current phase supplied by
   `aidd-cycle`; do not put cycle control or next-Goal creation in the objective.

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
workspace is ambiguous, a user constraint would be ignored, the selected
rule-map subgraph is unresolved, or the Goal cannot fit the character budget
without losing required execution context.
