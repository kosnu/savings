---
applyTo: "apps/web/**"
---

# Copilot Instructions for Web Frontend (apps/web/)

## 必須ルール

- この領域の作業は `apps/web/` で実行する。
- 運用は Taskfile を優先し、`task check` / `task test` を使う。
- Taskfile で不足する場合のみ npm scripts を直接実行する（例: `npm run build`）。
- 依存関係の導入・更新は `npm ci` を使う（`npm install` は使わない）。
- 新規コンポーネントは `npm run plop` を優先する。
- 設計判断は `apps/web/docs/adr/` を参照する。

## 参照先

- `apps/web/README.md`
- `apps/web/docs/adr/feature_directory.md`
