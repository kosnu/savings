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
- Documentation policy: `docs/documentation-policy.md`
- When a task may touch documented design decisions, policies, or operational guidance, inspect Markdown front matter in the docs directories and read the relevant docs for the current session.
- Use front matter fields such as `area`, `applies_to`, `topics`, `when_to_read`, and `status` to choose which docs apply. Do not rely on `deprecated` docs unless the task explicitly concerns deprecated behavior.
- Commit messages in Japanese, type in English (feat/fix/chore/refactor/test/docs)
- No unrelated code changes
- When changing an existing workflow, command path, or configuration surface, follow the established pattern in the same layer unless there is a clear reason to change it.
- If you intentionally diverge from an existing pattern, explain why before applying the change.

## Agent Operating Guidance

These rules refine the repository conventions above. Use them to choose efficient, evidence-based behavior without weakening the mandatory rules below.

### Goal And Success Criteria

- Use outcome-first execution: identify the requested outcome, constraints, and concrete success criteria before choosing an implementation path.
- Prefer the smallest useful path that satisfies the success criteria while preserving correctness, repository conventions, and user intent.
- Treat `must`, `always`, `never`, and `only` as true invariants. For judgment calls, use decision rules and repo evidence instead of process-heavy instructions.
- Stop when the user's core request is handled with sufficient evidence and required verification. Do not pursue adjacent refactors or polish unless they are necessary for correctness.

### Communication

- Communicate with the user in Japanese, consistent with the Language section.
- Be direct, concise, and evidence-based. Give enough context for the user to evaluate the work, then stop.
- Answer any sentence ending with `?` or `？` before taking action.
- When the user asks for an explanation, answer directly. Do not turn the explanation into `<proposed_plan>` or unsolicited remediation options.
- For multi-step or tool-heavy work, send a short progress update before the first tool call and occasional concise updates during longer work. Keep updates focused on what is being checked or changed.
- Ask a narrow clarification question only when the missing information would materially change the implementation, create meaningful risk, or conflict with existing instructions.

### Evidence And Retrieval

- Prefer repository evidence over external search: inspect the relevant docs, code, workflows, migrations, tests, and issue or PR context before making architectural or behavioral claims.
- Use the documentation front matter rules in Key Conventions to decide which docs to read when design decisions, policies, or operational guidance may apply.
- Start with the smallest search or file read that can answer the core request. Search again only when required facts, owners, dates, APIs, files, or behavior remain unsupported.
- Do not keep searching to improve wording, collect nonessential examples, or support claims that can safely be made more general.
- If evidence is missing, state the gap plainly and either ask for the smallest missing input or proceed with a clearly named assumption when the risk is low.

### Implementation Discipline

- Keep changes narrowly scoped to the user request and the directly necessary dependency closure.
- Follow established patterns in the same layer. If an existing pattern is unsuitable, explain the reason before diverging.
- Preserve user or unrelated worktree changes. Do not rewrite, revert, reformat, or stage unrelated files.
- Before adding, moving, or extracting Web components, apply the mandatory component structure policy below.

### Validation And Final Response

- Use the Verification section below as the source of truth for runtime, build, type-safety, and migration checks.
- When application code changes, run the concrete affected-app commands from the repository root unless the current diff is exactly identical to the most recent verified diff.
- For documentation-only changes, do not run app verification commands.
- In the final response, summarize what changed, where it changed, and which verification ran or why verification was skipped.
- For blockers, report the exact blocker, what was already checked, and the smallest useful next step.

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
- Run independent verification commands in parallel when practical.
- Do not start multiple instances of the same verification command at the same time.
- When running verification commands in parallel, if one command fails before the others finish,
  wait for all already-started verification commands to finish before making fixes or rerunning checks.
- After fixing a failure, start any required reruns as a new verification batch only after the previous batch has fully completed.

- **Web** (`apps/web/`)
  `pnpm run web:lint`
  `pnpm run web:format-check`
  `pnpm run web:typecheck`
  `pnpm --filter web test:unit`
  `pnpm --filter web test:integration`
  `pnpm --filter web test:storybook`
- **API** (`apps/api`)
  No dedicated verification commands are currently defined. If verification commands are added later, define the concrete commands here.
