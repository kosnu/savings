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
- Commit messages in Japanese, type in English (feat/fix/chore/refactor/test/docs)
- No unrelated code changes
- When changing an existing workflow, command path, or configuration surface, follow the established pattern in the same layer unless there is a clear reason to change it.
- If you intentionally diverge from an existing pattern, explain why before applying the change.

## Verification

Run verification commands from the repository root
when the change includes application code,
or any changes to build/type configuration or DB migrations
that can affect runtime behavior, build output, or type safety.

Documentation-only changes or other changes
that do not affect runtime behavior, build output, or type safety
do not require verification.

- **Web** (`apps/web/`): `task web:verify`
