# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

Respond to the user in Japanese.

## Project Overview

Personal savings management app. Monorepo with two apps (`apps/web/` and `apps/api/`) and infrastructure (`infra/`).

## Commands

### Web Frontend (`apps/web/`)

Prefer Taskfile commands. Run all commands from `apps/web/`.

```bash
task check          # Lint & format (Biome, auto-fix)
task test           # Run all Vitest tests (unit + Storybook)
npm test -- --silent --reporter=dot src/features/payments/listPayment/PaymentList/PaymentList.test.tsx  # Single test file
npm run dev         # Vite dev server
npm run build       # TypeScript check + production build
npm run storybook -- --no-open  # Storybook
npm run plop        # Scaffold new component
npm ci              # Install dependencies (never use npm install)
```

Vitest has two projects: `unit/integration` (jsdom) and `storybook` (Playwright browser). Tests are co-located with source files as `*.test.ts(x)`.

### API Backend (`apps/api/`)

Prefer Taskfile commands. Run all commands from `apps/api/`.

```bash
task up             # Start Supabase + serve all Edge Functions
task down           # Stop everything
task up:migrations  # Apply DB migrations
task logs:functions:payments    # Tail payments function logs
task logs:functions:categories  # Tail categories function logs

# Tests (run from the specific function directory)
cd supabase/functions/payments && deno test --allow-read --allow-env
cd supabase/functions/categories && deno test --allow-read --allow-env

# Migrations
npx supabase migration new <name>
npx supabase migration up
```

### Root-level (Docker / Firebase Emulator)

```bash
task up       # docker compose up -d (Firebase emulators)
task down     # docker compose down
task build    # docker compose build
```

## Architecture

### Web (`apps/web/`) — React + TypeScript + Vite

- **Routing**: `react-router-dom` — routes defined in `src/app/Router.tsx`, paths in `src/config/paths`
- **State/Data**: `@tanstack/react-query` for server state, `@tanstack/react-form` for forms
- **UI**: Radix UI Themes (`@radix-ui/themes`)
- **Auth/DB**: Firebase (Auth + Firestore), emulators for local dev
- **Validation**: Zod
- **Lint/Format**: Biome (`biome.json`) — double quotes, space indent, optional semicolons
- **Feature directory pattern** (ADR-approved):
  ```
  src/features/<feature>/
    components/       # Feature-specific UI
    hooks/            # Feature-specific hooks
    utils/            # Feature-specific utilities
    types/            # Feature-specific types
    <feature>.tsx     # Entry point
  ```
  Sub-features nest further (e.g., `payments/listPayment/`, `payments/createPayment/`).
- Shared UI in `src/components/`, utilities in `src/utils/`, providers in `src/providers/`

### API (`apps/api/`) — Supabase Edge Functions + Deno + Hono

Each function (`payments`, `categories`) is an independent Supabase Edge Function under `supabase/functions/` using **clean architecture**:

```
src/
  domain/          # Entities, value objects, repository interfaces (pure, no deps)
  application/     # Use cases, DTOs
  infrastructure/  # Supabase/Postgres repository implementations
  interfaces/      # Hono HTTP handlers, routes, input validation
  shared/          # Common types, errors, result type
```

Dependency flow: `interfaces → application → domain ← infrastructure`

- **Runtime**: Deno 2.x
- **HTTP**: Hono framework
- **DB**: PostgreSQL via Supabase client
- **Auth**: JWT verification (`verify_jwt = true`)
- **DI**: Explicit injection at server initialization (`interfaces/server.ts`), no DI container
- **Style**: `deno fmt`, `deno lint`
- Migrations in `supabase/migrations/`, seed data in `supabase/seed/`

### Infrastructure (`infra/`)

Terraform managing Supabase (DB module) and Firebase Hosting. Production environment in `infra/terraform/environments/production/`.

## Key Conventions

- Deno projects (`apps/api/`, `scripts/import_to_firestore/`): avoid `deno install` — use `deno task` / Supabase CLI / Taskfile
- API architecture docs are authoritative: `apps/api/docs/architecture.md`, `apps/api/docs/payment-modeling.md`, `apps/api/docs/category-modeling.md`
- Web design decisions: `apps/web/docs/adr/`
