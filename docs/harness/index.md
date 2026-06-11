---
title: Harness Documentation Index
doc_type: overview
status: draft
area: repository
applies_to:
  - AGENTS.md
  - CLAUDE.md
  - docs
  - docs/harness
topics:
  - ai-driven-development
  - agentic-coding
  - agent-guidance
  - documentation
  - harness-engineering
when_to_read:
  - AI agent向けのリポジトリ構造やドキュメント体系を設計するとき
  - AGENTS.mdやCLAUDE.mdを薄い入口として整理するとき
  - docsをagentが辿れる記録システムとして整備するとき
---

# Harness Documentation Index

`docs/harness/` は、AI agent が作業時に参照するガードレール文書と索引を置きます。

ここには、ハーネスエンジニアリングの説明文書ではなく、agent が実際に参照する policy、domain rule、探索メタデータ、ルールマップを置きます。

ハーネスエンジニアリングの採用判断は [../adr/0001-adopt-harness-engineering.md](../adr/0001-adopt-harness-engineering.md) に、ルールグラフの採用判断は [../adr/0002-adopt-agent-rule-graph.md](../adr/0002-adopt-agent-rule-graph.md) に置きます。

## 構成

- [rule-map.json](./rule-map.json): 作業対象に応じて読むべき Markdown へ案内する初期索引。
- [policies/](./policies/): Git、review feedback、transaction boundary、temporal data、documentation policy など、agent が守るリポジトリ横断の運用ルール。
- [domain/](./domain/): 金額、支払い、カテゴリ、月予算など、agent が仕様判断や実装判断で参照するドメインルール。

## 使い方

agent は、作業開始時に依頼を `path`, `domain`, `activity`, `topic` へ分類します。

その分類をもとに [rule-map.json](./rule-map.json) から候補文書を選び、`depends_on` を辿って前提文書を追加します。競合がある場合は `overrides` と `priority` で整理します。

最終的に読むのは、選択されたサブグラフに含まれる Markdown だけです。`rule-map.json` は知識ベースそのものではなく、正本である `docs/**/*.md` や `apps/*/docs/**/*.md` へ案内する補助索引です。

## 他のdocsとの関係

`docs/harness/` は、既存の `docs/` を置き換えません。

- `docs/ai-driven-development/`: Goal、PRD、Design、Build / Verify、Ship / Learn などのAI駆動開発フロー。
- `docs/harness/policies/`: リポジトリ横断の運用ガードレール。
- `docs/harness/domain/`: ドメイン判断のガードレール。
- `apps/*/docs/`: アプリ固有のADR、設計判断、実装方針。

`docs/harness/` は、agent が読むべきガードレールの正本と、それ以外の docs を含めて辿るための索引を持ちます。`docs/ai-driven-development/` や `apps/*/docs/` は責務が異なるため移動せず、[rule-map.json](./rule-map.json) から `file` で参照します。

## 配置基準

次に該当する文書は `docs/harness/` に置きます。

- agent が作業時に守る policy、rule、domain constraint。
- agent が読むべき文書を選択する索引、ルールマップ、探索プロトコルそのもの。
- Markdown のルールを lint、CI、tests、scripts へ昇格する判断基準。

次に該当する文書は `docs/harness/` に置きません。

- 個別機能のPRDやDesign Doc。
- 特定アプリに閉じたcomponent、DB、API、UIの設計判断。
- ハーネスエンジニアリングやルールグラフの採用判断。

それらは `docs/` 直下、`docs/ai-driven-development/`、`apps/*/docs/` に置き、必要に応じて `docs/harness/rule-map.json` から参照します。
