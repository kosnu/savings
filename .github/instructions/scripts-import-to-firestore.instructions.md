---
applyTo: "scripts/import_to_firestore/**"
---

# Copilot Instructions for Firestore Import Scripts (scripts/import_to_firestore/)

## 必須ルール

- この領域の作業は `scripts/import_to_firestore/` で実行する。
- ランタイムは Deno 2.x を使う。
- 実行時は必要なパーミッションを明示する（`--allow-read`, `--allow-env`, `--allow-net` など）。
- 秘密情報（`.env`, サービスアカウントキー）はコミットしない。

## 検証コマンド

- `deno check`
- `deno fmt --check`
- `deno lint`
- `deno test --allow-read`

## 実行コマンド

- `deno run --allow-env --allow-read --allow-net main.ts --file path/to/data.csv --collection payments`
- `task insert -- --file path/to/example.csv --collection {collection_name}`

## 参照先

- `scripts/import_to_firestore/README.md`
- `scripts/import_to_firestore/docs/test_guideline.md`
