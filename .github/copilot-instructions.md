# Copilot Instructions for Savings Repository

## 基本ルール

- ユーザー向け回答は日本語で行う。
- path 固有ルールは `.github/instructions/*.instructions.md` を優先する。
- コマンドは対象ディレクトリ (`apps/web/`, `apps/api/`, `scripts/import_to_firestore/`) で実行する。
- `apps/web/` は Taskfile (`task check`, `task test`) を優先し、依存関係導入時のみ `npm ci` を使う。
- Deno プロジェクトでは `deno install` 系コマンドを避け、`deno task` / Supabase CLI / Taskfile を使う。

## 参照先

- `apps/web/README.md`
- `apps/api/README.md`
- `scripts/import_to_firestore/README.md`
