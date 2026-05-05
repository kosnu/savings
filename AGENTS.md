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
