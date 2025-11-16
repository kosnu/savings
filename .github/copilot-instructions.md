# Copilot Instructions for Savings Repository

## Overview

Personal finance tracking app: **React 19 + TypeScript + Vite** frontend, **Firebase** backend (Auth, Firestore, Hosting). Includes web app (`apps/web/`) and Deno import scripts (`scripts/import_to_firestore/`).

**Path-specific instructions**: 詳細ルールは `.github/instructions/` を参照してください。

- `apps-web.instructions.md` : React/Vite フロントエンドの構成と開発ルール
- `apps-api.instructions.md` : Supabase Edge Functions (Deno) バックエンドの構成と開発ルール
- `scripts-import-to-firestore.instructions.md` : Deno 製 Firestore インポートスクリプトの構成と開発ルール

## General Rules

- **日本語で回答してください** (Please respond in Japanese when interacting with users)
- **Path specific policies take precedence**: 必要に応じて `.github/instructions/*.instructions.md` を先に確認すること
- **Run from correct directory**: 各プロジェクト配下 (`apps/web/`, `apps/api/`, `scripts/import_to_firestore/`) でコマンド実行
- **Package installation**: フロントエンドは必ず `npm ci`、Deno プロジェクトは `deno install` 系コマンドを避け `deno task` / Supabase CLI を利用
- **Code edits**: 既存方針に従い ASCII を基本とし、必要最小限のコメントのみ追加

## Repository Structure

```
savings
├── apps
│   ├── api/                         # Supabase Edge Functions (Deno) - see apps-api instructions
│   └── web/                         # React 19 + TypeScript + Vite frontend - see apps-web instructions
├── scripts/import_to_firestore/     # Deno Firestore import scripts - see scripts instructions
├── infra/terraform/                 # Infrastructure as Code (Terraform)
├── docker/                          # Firebase Emulator & tooling
├── Taskfile.yml                     # Task runner (Docker & Supabase helpers)
├── compose.yml                      # Firebase Emulator docker compose
└── firebase.json                    # Firebase hosting config
```

**See path-specific instructions** in `.github/instructions/` for detailed structure of each application.

## CI/CD Workflows

- `.github/workflows/frontend_ci.yaml` : `apps/web/**` 変更時に Biome / Vitest / Playwright / Vite build を実行
- `.github/workflows/scripts_ci.yaml` : `scripts/**` 変更時に Deno check / fmt / lint / test を実行
- `.github/workflows/deploy_web.yaml` : フロントエンドを Firebase Hosting へ手動デプロイ
- バックエンド (`apps/api/`) のローカル動作は Supabase CLI で担保。CI 設定を追加する場合は Supabase CLI ベースで統一

詳細なワークフローの扱いは各ディレクトリの instructions を参照してください。

## Common Tools & Services

- **Firebase Emulator**: `docker compose up -d` で起動。フロントエンドの統合テストや Firebase 連携周りで使用
- **Supabase CLI**: バックエンド Edge Functions のローカル実行・マイグレーション (`task up`, `task up:migrations` など)
- **Task Runner**: ルート `Taskfile.yml` で Docker/Supabase 操作を共通化
- **Playwright / Vitest / Biome**: フロントエンド CI とローカル開発で使用。詳細は `apps/web` 指示を参照
- **Deno CLI**: Firestore インポートや Edge Functions 開発に使用。バージョンは指示ファイルの推奨を守ること
