---
title: Documentation Policy
doc_type: policy
status: accepted
area: repository
applies_to:
  - docs
  - apps/web/docs
  - apps/api/docs
topics:
  - documentation
  - front-matter
  - agent-guidance
when_to_read:
  - ドキュメントを追加または更新するとき
  - Codexが参照するドキュメントを判断するとき
  - AGENTS.mdのドキュメント参照方針を変更するとき
---

# Documentation Policy

このリポジトリの恒常的なドキュメントは、front matter を使って対象領域と参照タイミングを明示します。

`AGENTS.md` は強制ルールとドキュメント探索の入口を定義します。各ドキュメントの front matter は、Codex や他の AI agent が現在の作業セッションで読むべき文書を選ぶための探索用メタデータとして扱います。

## 対象

front matter を付ける対象は、`docs/` と `apps/*/docs/` 配下の恒常ドキュメントです。

README、`AGENTS.md`、ローカルメモ、作業途中の一時ファイルは対象外です。

## 標準項目

```yaml
---
title: Document Title
doc_type: overview
status: accepted
area: repository
applies_to:
  - docs
topics:
  - documentation
when_to_read:
  - ドキュメントを追加または更新するとき
---
```

- `title`: ドキュメント名。
- `doc_type`: `overview`, `adr`, `policy` などの文書種別。
- `status`: `accepted`, `draft`, `deprecated` などの状態。
- `area`: 主な対象領域。例: `repository`, `web`, `api`, `infrastructure`。
- `applies_to`: 関連するディレクトリ、アプリ、設定面。
- `topics`: 検索や関連判断に使う技術・概念。
- `when_to_read`: その文書を読むべき作業状況。

## 参照ルール

作業開始時に関連しそうな恒常ドキュメントがある場合は、`docs/` と `apps/*/docs/` 配下を確認し、front matter の `area`, `applies_to`, `topics`, `when_to_read`, `status` を見て読む文書を選びます。

`status: deprecated` の文書は、廃止済みの挙動や移行経緯を調べる場合を除き、現在の実装方針の根拠にしません。

front matter は探索用メタデータであり、強制ルールではありません。必ず守るべきルールは `AGENTS.md` に置きます。
