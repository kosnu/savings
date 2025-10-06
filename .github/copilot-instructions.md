# Copilot Instructions for Savings Repository

## Overview
Personal finance tracking app: **React 19 + TypeScript + Vite** frontend, **Firebase** backend (Auth, Firestore, Hosting). Includes web app (`apps/web/`) and Deno import scripts (`scripts/import_to_firestore/`).

**Path-specific instructions**: Detailed instructions for each application are in `.github/instructions/`:
- `apps-web.instructions.md` - React/Vite frontend specifics
- `scripts-import-to-firestore.instructions.md` - Deno script specifics

## General Rules

- **日本語で回答してください** (Please respond in Japanese when interacting with users)
- **ALWAYS use `npm ci`** (not `npm install`) for web app
- **Run from correct directory**: Web from `apps/web/`, Deno from `scripts/import_to_firestore/`

## Repository Structure

```
savings/
  ├── apps/web/                      # React 19 + TypeScript + Vite frontend
  ├── scripts/import_to_firestore/   # Deno CSV import scripts
  ├── infra/terraform/               # Infrastructure as Code
  ├── docker/                        # Firebase Emulator Docker setup
  ├── Taskfile.yml                   # Task runner (Docker shortcuts)
  ├── compose.yml                    # Firebase Emulator (ports 8080, 9099, 4000)
  └── firebase.json                  # Hosting config
```

**See path-specific instructions** in `.github/instructions/` for detailed structure of each application.

## CI/CD Workflows

### GitHub Actions
- **frontend_ci.yaml**: PR checks for `apps/web/**` - Biome, Playwright, tests, build
- **scripts_ci.yaml**: PR checks for `scripts/**` - Deno check, fmt, lint, test
- **deploy_web.yaml**: Manual deploy to Firebase Hosting

**Details**: See path-specific instructions for each application's CI/CD requirements.

## Common Tools & Services

### Firebase Emulator
Tests require emulator at localhost:8080/9099. Start with:
```bash
docker compose up -d
```
May fail on Docker image build - skip tests if unavailable.

### Task Runner
Use `task` from repo root for Docker operations:
```bash
task build   # Build Docker images
task up      # Start services
task down    # Stop services
```
