# AGENTS.md

Guidance for all AI agents working in this repository.

## Language

- **Chat and comments**: Use Japanese when communicating with the user, and in inline code comments.

## Project Overview

Personal savings management app. Monorepo with two apps (`apps/web/` and `apps/api/`).

## Architecture

- **Web** (`apps/web/`): React + TypeScript + Vite. Design decisions: `apps/web/docs/adr/`
- **API** (`apps/api/`): Supabase (DB migrations, Auth config)

## Key Conventions

- Repository-wide docs: `docs/`
- App-specific docs: `apps/*/docs/`
- Documentation policy: `docs/harness/policies/documentation-policy.md`
- Harness engineering ADR: `docs/adr/0001-adopt-harness-engineering.md`
- Agent rule graph ADR: `docs/adr/0002-adopt-agent-rule-graph.md`
- Agent rule map: `docs/harness/rule-map.json`
- When a task may touch documented design decisions, policies, or operational guidance, inspect Markdown front matter in the docs directories and read the relevant docs for the current session.
- When a task may require multiple related policies, domain rules, ADRs, or design decisions, use `docs/harness/rule-map.json` to choose the relevant document subgraph.
- Use front matter fields such as `area`, `applies_to`, `topics`, `when_to_read`, and `status` to choose which docs apply. Do not rely on `deprecated` docs unless the task explicitly concerns deprecated behavior.
- Commit messages in Japanese, type in English (feat/fix/chore/refactor/test/docs)
- No unrelated code changes
- When changing an existing workflow, command path, or configuration surface, follow the established pattern in the same layer unless there is a clear reason to change it.
- If you intentionally diverge from an existing pattern, explain why before applying the change.

## Agent Operating Guidance

Use these rules to apply the repository conventions efficiently without weakening the mandatory rules below.

### Goal And Success Criteria

- Start from the requested outcome, constraints, and success criteria; then choose the smallest useful path that preserves correctness, repository conventions, and user intent.
- Treat `must`, `always`, `never`, and `only` as true invariants. For judgment calls, use decision rules and repo evidence instead of process-heavy instructions.
- Stop when the core request is handled with sufficient evidence and required verification; do not pursue adjacent refactors or polish unless needed for correctness.

### Communication

- Communicate in Japanese. Be direct, concise, and evidence-based; give enough context for evaluation, then stop.
- Answer any sentence ending with `?` or `？` before taking action. For explanation requests, answer directly without expanding into unsolicited plans or remediation options.
- For multi-step or tool-heavy work, send a short progress update before the first tool call and occasional concise updates focused on what is being checked or changed.
- Ask a narrow clarification question only when missing information would materially change the implementation, create meaningful risk, or conflict with instructions.

### Evidence And Retrieval

- Prefer repository evidence over external search: inspect relevant docs, code, workflows, migrations, tests, and issue or PR context before architectural or behavioral claims.
- Use Key Conventions front matter rules when design decisions, policies, or operational guidance may apply.
- Start with the smallest search or file read that can answer the request. Search again only for unsupported required facts, owners, dates, APIs, files, or behavior.
- Do not keep searching to improve wording, collect nonessential examples, or support claims that can safely be generalized.
- If evidence is missing, state the gap and either ask for the smallest missing input or proceed with a named low-risk assumption.

### Implementation Discipline

- Keep changes scoped to the request and necessary dependency closure. Preserve user or unrelated worktree changes; do not rewrite, revert, reformat, or stage unrelated files.
- Follow established patterns in the same layer. If unsuitable, explain before diverging.
- Before adding, moving, or extracting Web components, apply the mandatory component structure policy below.

### Validation And Final Response

- Use the Verification section as the source of truth. Run affected-app commands for application changes unless the current diff exactly matches the most recent verified diff.
- For documentation-only changes, do not run app verification commands.
- In the final response, summarize what changed, where, and which verification ran or why it was skipped. For blockers, include what was checked and the smallest useful next step.

## Mandatory Web Component Structure Rules

The rules in this section are mandatory and must always be followed.

- Before adding, moving, or extracting Web components, read and follow `apps/web/docs/policies/component-structure.md`.
- If a requested change or review comment conflicts with that policy, stop and clarify before editing.

## Mandatory Communication Rules

The rules in this section are mandatory and must always be followed.

- Any sentence ending with `?` or `？` MUST be treated as a question. You MUST answer it before taking any action.
- Do not jump to conclusions.
- Do not solve issues by taking the shortest path alone.

## Verification

Run verification commands from the repository root
when the change includes application code,
or any changes to build/type configuration or DB migrations
that can affect runtime behavior, build output, or type safety.

Documentation-only changes or other changes
that do not affect runtime behavior, build output, or type safety
do not require verification.

- Define verification as the concrete commands for each app, not a `verify` wrapper task.
- When application code changes, run the verification commands for the affected app from the repository root.
- If the current diff is exactly identical to the diff for the most recent run of the same verification commands, you may skip rerunning them.
- Run the listed independent verification commands in parallel when practical.
- Do not start multiple instances of the same verification command at the same time.
- When running verification commands in parallel, if one command fails before the others finish,
  wait for all already-started verification commands to finish before making fixes or rerunning checks.
- After fixing a failure, start any required reruns as a new verification batch only after the previous batch has fully completed.

- **Web** (`apps/web/`)
  Run these commands in the same verification batch:
  `pnpm run web:lint`
  `pnpm run web:format-check`
  `pnpm run web:typecheck`
  `pnpm --filter web exec vp test run --project unit --project integration --reporter=dot --silent`

  Run `pnpm --filter web test:storybook --reporter=dot --silent` only when the change affects `browser-test` tagged stories, `apps/web/.storybook-test/`, or Storybook browser-test configuration.
- **API** (`apps/api`)
  No dedicated verification commands are currently defined. If verification commands are added later, define the concrete commands here.
