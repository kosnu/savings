# Copilot Instructions for Savings Repository

## Overview
Personal finance tracking app: **React 19 + TypeScript + Vite** frontend, **Firebase** backend (Auth, Firestore, Hosting). Includes web app (`apps/web/`) and Deno import scripts (`scripts/import_to_firestore/`). Uses **Biome** (not ESLint), **Vitest + Playwright**, **Storybook**. 174 tests, 32 stories. Node 24.9.0 (20.x works), Deno 2.x.

## General Rules

- **日本語で回答してください** (Please respond in Japanese when interacting with users)

## Build & Validation

### Web App (apps/web/) - Run from this directory
```bash
npm ci                              # ALWAYS use npm ci (not install)
npm run check                       # Biome lint (use check-write to auto-fix)
npm run check -- --error-on-warnings  # CI mode
npm run build                       # tsc -b && vite build → apps/web/dist/
npm run test                        # Requires Firebase Emulator (see below)
npm run test -- --reporter=dot --silent  # CI mode
npm run storybook                   # Dev on :6006
npm run plop                        # Generate components
```

**Critical**: Uses **Biome** (not ESLint). Config: `biome.json`. Build takes ~5-10s. No env vars needed for build.

**Testing Prerequisites**:
1. Firebase Emulator must run: `docker compose up -d` from repo root (may fail on network issues)
2. Install Playwright: `npx playwright install --with-deps chromium`
3. Emulator ports: 8080 (Firestore), 9099 (Auth), 4000 (UI)
4. Test config: `vitest.config.ts` (env vars hardcoded, not from .env.test)

### Deno Scripts (scripts/import_to_firestore/)
```bash
deno check && deno fmt --check && deno lint  # All checks
deno test --allow-read              # Run tests
deno run --allow-env --allow-read main.ts --file x.csv --collection y
```
Config: `deno.json`. Requires `.env` from `.env.sample`.

## Project Structure

### Root
- `Taskfile.yml`: Docker compose shortcuts (`task build`, `task up`, `task down`)
- `compose.yml`: Firebase Emulator (ports 8080, 9099, 4000)
- `firebase.json`: Hosting config (deploys `apps/web/dist`)

### apps/web/
```
src/
  app/              # Router, Layout, Header, Sidebar
  components/       # Reusable UI (~212KB)
  features/         # Feature modules (~320KB): payments/, summaryByMonth/
  providers/        # Context providers (~88KB)
  lib/, utils/, types/, config/, test/, assets/
  main.tsx          # Entry point

Config: biome.json, vite.config.ts, vitest.config.ts, tsconfig.json, .npmrc
Templates: plopfile.mjs, generators/component/
```

### scripts/import_to_firestore/
```
src/config/       # env.ts (Deno.env), args.ts
deno.json         # Config
docs/test_guideline.md  # Testing guide (Japanese)
```

### .github/
```
workflows/
  frontend_ci.yaml    # PR: biome, playwright, test, build
  scripts_ci.yaml     # PR: deno check/fmt/lint/test
  deploy_web.yaml     # Manual deploy to Firebase
actions/
  cache-npm/          # npm caching
  setup-playwright/   # Playwright with version cache
```

## CI/CD Workflows

### frontend_ci.yaml (PRs to apps/web/**)
1. Setup Node.js → `npm ci` → Biome check with `--error-on-warnings`
2. Setup Playwright (cached by version)
3. Wait for Firebase Emulator service (Docker: `ghcr.io/kosnu/savings-firebase:latest`)
4. Run tests → Build

### scripts_ci.yaml (PRs to scripts/**)
Setup Deno 2.x → `deno check` → `fmt --check` → `lint` → `test --allow-read`

### deploy_web.yaml (Manual)
Auth to GCP → Install deps → Build with Firebase env vars → Deploy via Firebase CLI

## Common Issues & Fixes

1. **Node Version Warning**: Node 20.x shows "Unsupported engine" but works. Prefer 24.9.0 if available.

2. **Playwright Missing**: Run `npx playwright install --with-deps chromium`. CI uses cached action.

3. **Emulator Required**: Tests need emulator at localhost:8080/9099. Use `docker compose up -d` (may fail on image build) or skip tests.

4. **Test Env Vars**: Hardcoded in `vitest.config.ts` (not read from .env.test per TODO):
   ```
   VITE_FIREBASE_PROJECT_ID: "savings-test"
   VITE_FIRESTORE_EMULATOR_HOST: "localhost:8080"
   VITE_FIREBASE_AUTH_DOMAIN: "http://localhost:9099"
   ```

5. **Biome not ESLint**: No `.eslintrc`. Use `npm run check`. Config: `biome.json`.

6. **Large Bundles**: Vite warns about 500KB+ chunks. Expected; optimized via `vite.config.ts` manual chunks.

7. **Deno Permissions**: Always include `--allow-read`, `--allow-env` flags as needed.

## Architecture Notes

**Key Libraries**: @radix-ui/themes (UI), @tanstack/react-query (state), firebase, react-router-dom, zod

**Structure**: Feature-based organization. `features/payments/` (CRUD), `features/summaryByMonth/` (reports). Context providers in `providers/` (Theme, Snackbar, Firebase).

**Known TODOs**: Several files note FirestoreTestProvider duplication in stories (marked FIXME). Test env reading from .env.test not implemented.

## Development Workflow

1. **Pull changes**: `npm ci` in `apps/web/`
2. **Before commit**: `npm run check` → `npm run test` (if emulator up) → `npm run build`
3. **New components**: Use `npm run plop` for consistency (generates .tsx + .stories.tsx + .test.tsx)
4. **Testing**: Unit/integration in `*.test.ts(x)` (174 files), visual in `*.stories.tsx` (32 files). Target 80% coverage.

## Validation Checklist

- [ ] `npm run check -- --error-on-warnings` passes (apps/web/)
- [ ] `npm run build` succeeds (apps/web/)
- [ ] `npm run test` passes if emulator available (apps/web/)
- [ ] `deno check && deno fmt --check && deno lint` pass (scripts/)
- [ ] `deno test --allow-read` passes (scripts/)
- [ ] No `.env`, `node_modules/`, `dist/` committed
- [ ] New components have tests + stories

## Key Points

- **ALWAYS use `npm ci`** (not `npm install`)
- **Use Biome** (`npm run check`), not ESLint
- **Run from correct directory**: Web from `apps/web/`, Deno from `scripts/import_to_firestore/`
- **Emulator for tests**: Set up via `docker compose up -d` or skip if unavailable
- **Trust instructions**: Only explore if info incomplete or contradictory
- **Task runner**: Use `task` from repo root for Docker ops (see Taskfile.yml)
