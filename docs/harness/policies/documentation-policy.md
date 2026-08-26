---
title: Documentation Policy
doc_type: policy
status: accepted
area: repository
applies_to:
  - docs
  - docs/harness
  - apps/web/docs
  - apps/api/docs
topics:
  - documentation
  - front-matter
  - agent-guidance
when_to_read:
  - ドキュメントを追加または更新するとき
  - Codexが参照するドキュメントを判断するとき
  - AGENTS.mdやdocs/harnessのドキュメント参照方針を変更するとき
---

# Documentation Policy

このリポジトリの恒常的なドキュメントは、front matter を使って対象領域と参照タイミングを明示します。

`AGENTS.md` は強制ルールとドキュメント探索の入口を定義します。`docs/harness/` は、AI agent が作業対象に応じて参照するガードレール文書と索引を定義します。各ドキュメントの front matter は、Codex や他の AI agent が現在の作業セッションで読むべき文書を選ぶための探索用メタデータとして扱います。

## 対象

front matter を付ける対象は、`docs/` と `apps/*/docs/` 配下の恒常ドキュメントです。

README、`AGENTS.md`、ローカルメモ、作業途中の一時ファイル、`.agents/skills/**` のskill定義は対象外です。

skill定義は正本ドキュメントではありません。workflow、policy、ADR、domain docs などの正本を作業時に適用させるための agent instruction として扱います。正本ドキュメント本文からskill定義を参照しません。`rule-map.json` で `.agents/skills/**` を扱う場合は、`rules[].file` ではなく `applies_to.paths` の作業対象 trigger に限定します。

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

front matter は探索用メタデータであり、強制ルールではありません。必ず守るべきルールは `AGENTS.md` に置きます。複数文書の関係や依存を agent に辿らせる場合は、`docs/harness/rule-map.json` で索引化します。

## 文書の責務

恒常ドキュメントは、同じタイミングで参照される内容ではなく、同じ責務や判断対象に属する内容でまとめます。

複数の責務にまたがる内容は、1つの文書にまとめず、責務ごとに文書を分けて相互リンクします。

## ADRの変更

ADRは意思決定時点の記録です。採択済みADRのDecision、Context、Consequences本文を後から現在方針に合わせて書き換えてはいけません。

既存ADRの補足が必要な場合は、日付付きのClarificationとして追記します。意思決定が変わる場合は、既存ADRを改変せず、新しいADRを作成して置き換え関係を明示します。

採択済みADRを含む差分では、PRのbase branchとのmerge-baseを基準に次を実行します。

```bash
python3 -B docs/harness/scripts/validate_accepted_adrs.py --repo-root . --base-ref origin/<base-branch>
```

validatorは指定したorigin remote-tracking branchとの単一merge-baseをbaselineにし、shallow historyと任意commit指定を拒否します。baselineで`doc_type: adr`かつ`status: accepted`の全文書を対象に、Context、Decision、Consequences、既存Clarificationのsource変更と文書の削除・移動を拒否します。既存履歴の末尾への日付付きClarification追記と、新しいADRの追加は許可します。
