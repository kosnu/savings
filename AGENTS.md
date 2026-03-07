# AGENTS.md

Guidance for all AI agents working in this repository.

## Language

- **Chat and comments**: Use Japanese when communicating with the user, and in inline code comments.

## Project Overview

Personal savings management app. Monorepo with two apps (`apps/web/` and `apps/api/`) and infrastructure (`infra/`).

## Architecture

- **Web** (`apps/web/`): React + TypeScript + Vite. Design decisions: `apps/web/docs/adr/`
- **API** (`apps/api/`): Supabase Edge Functions + Deno + Hono (clean architecture). Details: `apps/api/docs/architecture.md`
- **Infra** (`infra/`): Terraform (Supabase + Cloudflare Pages)

## Key Conventions

- Deno projects (`apps/api/`): avoid `deno install` — use `deno task` / Supabase CLI / Taskfile
- API architecture docs are authoritative: `apps/api/docs/architecture.md`, `apps/api/docs/payment-modeling.md`, `apps/api/docs/category-modeling.md`
- Web design decisions: `apps/web/docs/adr/`
- Commit messages in Japanese, type in English (feat/fix/chore/refactor/test/docs)
- No unrelated code changes

## Commands

- Web: `task web:check && task web:test` (run from repo root)
- API: `task api:verify && task api:test` (run from repo root; verify = type-check + lint + fmt)
