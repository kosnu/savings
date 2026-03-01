# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal savings management app. Monorepo with two apps (`apps/web/` and `apps/api/`) and infrastructure (`infra/`).

## Architecture

- **Web** (`apps/web/`): React + TypeScript + Vite. Details: `apps/web/docs/adr/`
- **API** (`apps/api/`): Supabase Edge Functions + Deno + Hono (clean architecture). Details: `apps/api/docs/architecture.md`
- **Infra** (`infra/`): Terraform (Supabase + Cloudflare Pages)

## Workflow

タスクの実装には `/task` コマンドを使用する。規模（Small / Medium / Large）はClaude が自動判定する。

| 自動判定 | 目安 | 動作 |
|----------|------|------|
| Small | 1-3ファイル、単純な修正 | 直接実装 |
| Medium | 4-10ファイル、単一アプリ | サブエージェント活用、計画承認あり |
| Large | 10+ファイル、FE+BE横断 | worktree並行実装、設計・API契約承認あり |

## Key Conventions

- Deno projects (`apps/api/`): avoid `deno install` — use `deno task` / Supabase CLI / Taskfile
- API architecture docs are authoritative: `apps/api/docs/architecture.md`, `apps/api/docs/payment-modeling.md`, `apps/api/docs/category-modeling.md`
- Web design decisions: `apps/web/docs/adr/`
- Commit messages in Japanese, type in English (feat/fix/chore/refactor/test/docs)
- No unrelated code changes
