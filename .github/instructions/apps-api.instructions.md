---
applyTo: "apps/api/**"
---

# Copilot Instructions for API Backend (apps/api/)

## 全般ルール

- **日本語で回答してください** (Please respond in Japanese when interacting with users)
- **このディレクトリから実行**: すべてのコマンドは `apps/api/` ディレクトリから実行してください

## 概要

- Supabase Edge Functions と Postgres を利用したバックエンド API 群 (Deno + TypeScript)
- Supabase CLI をタスク実行 (`Taskfile.yml`) でラップし、ローカル開発は `npx supabase functions serve` をバックグラウンド起動
- 推奨 Deno バージョンは v2.1.14（Edge Functions 互換）

## ディレクトリ構成

```
apps/api
├── Taskfile.yml           # Supabase CLI のラッパータスク (up/down/migrations 等)
├── supabase
│   ├── config.toml        # Edge Functions の設定 (verify_jwt, import_map など)
│   ├── functions
│   │   ├── categories
│   │   │   ├── index.ts   # エントリーポイント (Deno.serve)
│   │   │   ├── deno.json  # import_map と fmt/lint 設定
│   │   │   └── src
│   │   │       ├── application
│   │   │       ├── domain
│   │   │       ├── infrastructure
│   │   │       ├── interfaces
│   │   │       └── shared
│   │   └── payments
│   │       ├── index.ts   # シンプルな Edge Function 実装
│   │       └── deno.json
│   ├── migrations         # Supabase CLI 形式の SQL マイグレーション
│   └── seed               # 初期データ (SQL)
├── bin                    # 補助スクリプト (例: init_seed)
└── docs/architecture.md   # クリーンアーキテクチャの設計指針
```

## 利用技術

- ランタイム: Deno 2.x (Edge Functions 向け、`@supabase/functions-js` タイピング)
- 言語: TypeScript (ESM)
- BaaS: Supabase (Edge Functions, Postgres, Auth JWT 検証)
- クライアント SDK: `@supabase/supabase-js@2.x`
- ツール: Supabase CLI (`npx supabase start/stop/functions serve`)、Taskfile (`task up`, `task down`, `task up:migrations` など)
- フォーマット/リント: `deno fmt`, `deno lint` 設定を各 function の `deno.json` に定義

## アーキテクチャ

- クリーンアーキテクチャ指向のレイヤ分離 (`docs/architecture.md` 参照)
  - `domain`: エンティティ・値オブジェクト・リポジトリ抽象
  - `application`: DTO とユースケース (ビジネスフロー)
  - `infrastructure`: Supabase/Postgres へのリポジトリ実装
  - `interfaces`: Hono 等の HTTP ハンドラを配置予定の境界層 (現在は Deno.serve)
  - `shared`: 全層で共有する型・エラー
- Edge Function は `index.ts` で Supabase クライアントを初期化し、認証ヘッダーを引き継いでレスポンスを返す
- JWT 検証 (`verify_jwt = true`) を前提とし、リクエストヘッダーの `Authorization` を Supabase クライアントに委譲
- マイグレーションは `supabase/migrations/*.sql` で管理し、CLI から適用 (`task up:migrations`)
