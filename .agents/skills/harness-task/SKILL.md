---
name: harness-task
description: "Execute clearly scoped repository tasks without creating a Codex Goal while preserving the repository harness: targeted grounding, rule-map document selection, size/risk checks, synchronized representations, Stop conditions, local review, and affected verification. Use when the user invokes $harness-task or asks to make a scoped implementation, docs, test, UI text, review-response, DB/API, or verification-failure change that does not need the full AI Driven Development Goal flow."
---

# Harness Task

## Purpose

Execute a clearly scoped repository task directly, without creating a Codex Goal.

Use this skill to keep smaller implementation, docs, test, UI text, review-response, DB/API, or verification-failure work inside the repository harness. Do not depend on `task-plan`, `task-execute`, or user-level skills. Apply their working style locally: ground the task, classify size/risk, keep representations synchronized, stop on material scope changes, review the diff, and verify affected behavior.

## Entry Gate

Before editing, confirm the request has enough information to execute:

- Outcome: the intended result is clear.
- Scope: the allowed write area is clear.
- Success criteria: completion can be checked.
- Verification: affected checks or manual evidence can be named.

Stop and ask only the missing question when any of these are ambiguous enough to change implementation, risk, or verification.

Stop instead of using this skill when:

- The request needs a new Requirements / PRD, Design Doc, or Codex Goal to settle product scope.
- The task is only an explanation, comparison, feasibility check, or open-ended investigation.
- GitHub or git writes are requested but the target, scope, approval, or safety condition is ambiguous.
- The required change would materially alter behavior, acceptance criteria, write scope, or verification strategy beyond the user's request.

Large work, DB changes, and API changes are not automatic Stop conditions. Continue when scope, acceptance criteria, rollback or recovery expectations, and verification are clear enough to execute safely.

## Grounding

Read the smallest useful set before implementation:

- Repository instructions such as `AGENTS.md`.
- Files, issues, PRs, errors, or commands named by the user.
- Nearby implementation, tests, stories, fixtures, mocks, or docs needed to preserve local patterns.
- `docs/harness/rule-map.json` when the task may touch documented behavior, policies, domain rules, ADRs, app guidance, DB/API behavior, review handling, or verification expectations.

When using `docs/harness/rule-map.json`:

- Classify the task by `path`, `domain`, `activity`, and `topic`.
- Select only the relevant rule nodes and their `depends_on` prerequisites.
- Read the selected Markdown sources before making claims or edits.
- Stop when the selected docs conflict and `overrides` / `priority` do not resolve the conflict.

Before adding, moving, or extracting Web components, read `apps/web/docs/policies/component-structure.md` and follow it.

## Work Shape

State the changed behavior in one sentence before editing.

Classify size by synchronized representation concerns, not raw file count:

- Small: one primary concern, even when repeated mechanically across files.
- Medium: two or three concerns, or one behavior change where synchronization can drift.
- Large: four or more concerns, cross-system contract changes, high-risk domains, migrations, or irreversible data changes.

Use size/risk only to choose grounding depth, subagent budget, review depth, and verification. Do not reject a task only because it is Large.

Name the representations that must stay synchronized, such as:

- UI or UX behavior.
- State management or validation.
- Types, schemas, migrations, RPCs, API boundaries, or mapping code.
- Tests, stories, fixtures, mocks, or generated data.
- Docs, policies, domain rules, or review responses included in scope.

Also name any related representations intentionally left unchanged when that boundary matters.

## Execution

Implement the smallest practical diff that satisfies the scoped task.

Keep representations synchronized. Treat one-sided updates as likely bugs even when tests pass.

During review and verification, extract reusable learning from review comments, findings, or changed constraints. Apply an explicitly requested, in-scope rule or policy update directly; otherwise report the learning as task context that can be used as Requirements material or harness-task input, or as a rule / policy candidate. This capability does not require invoking `learn`, although `learn` may be used when a dedicated learning handoff is requested.

Use subagents sparingly:

- Small: main agent implements and reviews by default.
- Medium: use at most one explorer or reviewer when it answers an independent risk.
- Large: use multiple subagents only when each has a clear, disjoint ownership boundary and main-agent integration remains controlled.

For Medium or Large work, track an execution checklist with files/modules, representations, acceptance criteria, verification, and Stop conditions.

Stop for user approval when implementation reveals that any of these must change materially:

- Intended behavior or acceptance criteria.
- Write scope.
- Size/risk classification.
- User-visible UX direction.
- Performance, data, rollout, rollback, or recovery risk.
- Verification strategy.
- Required synchronized representation set.

Minor local choices inside the approved scope do not require approval. Proceed and mention them in the final report only when useful.

## Review And Verification

Review every implemented diff before final verification. For Small work, a main-agent checklist review is enough unless risk justifies an independent reviewer.

Check for:

- Regressions and edge cases.
- Missing or stale tests.
- Unsynchronized representations.
- Old behavior or assumptions still present in sibling flows, docs, mocks, stories, or tests.
- Repository pattern drift or selected harness rule violations.

Run verification from the repository root according to `AGENTS.md`:

- Application code, build/type config, or DB migration changes: run affected-app verification.
- Web application code: run `pnpm run web:format` before the Web verification batch.
- Documentation-only or non-runtime skill/docs changes: do not run app verification.
- Storybook browser tests: run only when affected by the change.

If verification fails, fix in scope and rerun the affected checks after any already-started verification batch finishes. Stop when the failure is unrelated to the task or requires scope expansion.

## Final Report

Return a concise outcome-first report:

- What changed and where.
- Main harness refs or selected rule-map nodes used.
- Verification run, skipped, or blocked.
- Review result and remaining risks, if any.
- Reusable learning as Task Context or a Rule / Policy candidate, only when one exists; omit it otherwise.

Do not reconstruct a long plan in the final report.
