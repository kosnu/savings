---
applyTo: "apps/api/**"
---

# Copilot Instructions for API Backend (apps/api/)

## 必須ルール

- この領域の作業は `apps/api/` で実行する。
- Supabase 操作は Taskfile を優先する（`task up`, `task down`, `task up:migrations`）。
- Deno 2.x（Edge Functions 互換）を前提に実装する。
- マイグレーションは `supabase/migrations/*.sql` で管理する。

## 実装方針

- レイヤ分離と責務は `apps/api/docs/architecture.md` の方針に従う。
- JWT 検証 (`verify_jwt = true`) 前提の実装を維持する。

## 参照先

- `apps/api/README.md`
- `apps/api/docs/architecture.md`
