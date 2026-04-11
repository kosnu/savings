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

- Web design decisions: `apps/web/docs/adr/`
- Storybook browser test policy: `docs/storybook-browser-tests.md`
- Commit messages in Japanese, type in English (feat/fix/chore/refactor/test/docs)
- No unrelated code changes
- When changing an existing workflow, command path, or configuration surface, follow the established pattern in the same layer unless there is a clear reason to change it.
- If you intentionally diverge from an existing pattern, explain why before applying the change.

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

- **Web** (`apps/web/`)
  `task web:lint`
  `task web:format-check`
  `task web:typecheck`
  `task web:test-unit`
  `task web:test-storybook`
- **API** (`apps/api`)
  No dedicated verification commands are currently defined. If verification commands are added later, define the concrete commands here.
