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

ハーネスエンジニアリングの採用判断は [../adr/0001-adopt-harness-engineering.md](../adr/0001-adopt-harness-engineering.md) に、ルールグラフと関連参照 edge の採用判断は [../adr/0002-adopt-agent-rule-graph.md](../adr/0002-adopt-agent-rule-graph.md) に置きます。

## 構成

- [rule-map.json](./rule-map.json): 作業対象に応じて読むべき Markdown へ案内する初期索引。
- [policies/](./policies/): Git、code review、review feedback、transaction boundary、temporal data、documentation policy など、agent が守るリポジトリ横断の運用ルール。
- [domain/](./domain/): 金額、支払い、カテゴリ、月予算など、agent が仕様判断や実装判断で参照するドメインルール。
- [contracts/](./contracts/): ドメインルールから分離して機能タスクが更新できる、属性一覧などの機械可読contract。

## 使い方

agent は、作業開始時に依頼を `path`, `domain`, `activity`, `topic` へ分類します。

文書の選択と依存・競合の扱いは [Documentation Policy](./policies/documentation-policy.md#現行ルールの選択) に従います。[rule-map.json](./rule-map.json) は対象作業から正本へ到達する索引です。

最終的に読むのは、選択されたサブグラフに含まれる Markdown だけです。`rule-map.json` は知識ベースそのものではなく、正本である `docs/**/*.md` や `apps/*/docs/**/*.md` へ案内する補助索引です。

## Rule Map Semantics

`rule-map.json` はグラフ理論の導入ではなく、agent が読むべき正本文書と、その参照関係を追跡するための軽量な索引です。

- `rules[].id`: 文書ノード。agent が参照対象を識別する安定ID。
- `rules[].file`: ノードの正本である Markdown へのパス。
- `rules[].applies_to`: 作業依頼から候補ノードを選ぶための selection predicate。`paths`, `domains`, `activities`, `topics` を使って、今回の作業に関係するノードを選びます。
- `rules[].depends_on`: prerequisite edge。選ばれたノードを読む前提として追加で読むべきノードを表します。
- `rules[].related`: non-prerequisite reference edge。前提ではないが、境界判断やレビュー時に併読するとよい文書を表します。
- `rules[].overrides`: conflict-resolution edge。複数ノードが同じ判断対象に異なる指示を持つ場合に、どちらを優先するかを表します。
- `rules[].priority`: conflict-resolution weight。`overrides` だけで整理できない候補の優先度を補助します。

`applies_to` はノード間の関係ではなく、作業依頼からノードを選ぶ条件です。ノード間の関係は `depends_on`、`related`、`overrides` で表します。

## Selected Subgraph

agent は、すべての docs を読むのではなく、選択されたノードと `depends_on` で追加された前提ノードだけを読みます。
`related` は選択済みサブグラフを必ず拡張する強制 edge ではなく、変更内容やレビュー観点に応じて使う併読候補です。

作業の判断・検証・レビューに適用規則の根拠を残す場合は、少なくとも次を記録します。専用の工程や成果物名は前提にしません。

- 作業分類: `path`, `domain`, `activity`, `topic`
- 選択されたノードIDと `file`
- 各ノードを選んだ理由
- `depends_on` で追加された前提ノード
- `related` を併読した場合の参照先と理由
- `overrides` や `priority` で競合を整理した場合の判断

選択結果の不足は、対象の判断に必要な文書を追加取得して確認します。意図・権限を変える不明点や、正本間の解消できない競合が残る場合は、その根拠と確認事項を示します。

## Provenance

provenance は、ルールがどの作業成果物や検証に効いているかを追跡するための記録です。まずは `rule-map.json` の schema へ新しい構造を追加せず、要求、設計判断、検証・レビューの記録、PR本文、review response などで必要最小限を記録します。

記録する最小単位は次です。

- rule node: 根拠になった `rules[].id`
- artifact: そのルールが効いた成果物や変更箇所
- enforcement: 完了条件の照合、検証、test、lint、reviewのどれで確認したか
- result: 確認結果、未確認事項、または停止した理由

この記録は正本 Markdown を置き換えません。ルール本文は引き続き各 Markdown に置き、provenance は agent が参照漏れ、逸脱、検証不足を見つけるための補助情報として扱います。

## 他のdocsとの関係

`docs/harness/` は、既存の `docs/` を置き換えません。

- [docs/ai-driven-development/](../ai-driven-development/overview.md): AI駆動開発の考え方と現行の運用契約。工程・記録形式・権限境界は対応する正本が所有します。
- `docs/harness/policies/`: リポジトリ横断の運用ガードレール。
- `docs/harness/domain/`: ドメイン判断のガードレール。
- `apps/*/docs/`: アプリ固有のADR、設計判断、実装方針。

`docs/harness/` は、agent が読むべきガードレールの正本と、それ以外の docs を含めて辿るための索引を持ちます。`docs/ai-driven-development/` や `apps/*/docs/` は責務が異なるため移動せず、[rule-map.json](./rule-map.json) から `file` で参照します。

## 配置基準

次に該当する文書は `docs/harness/` に置きます。

- agent が作業時に守る policy、rule、domain constraint。
- agent が読むべき文書を選択する索引、ルールマップ、探索プロトコルそのもの。
- Markdown のルールを lint、CI、tests、scripts へ昇格する判断基準。
- 恒久ルールが参照し、機能タスクで同期更新する機械可読なドメインcontract。

次に該当する文書は `docs/harness/` に置きません。

- 個別機能の要求や設計の記録。
- 特定アプリに閉じたcomponent、DB、API、UIの設計判断。
- ハーネスエンジニアリングやルールグラフの採用判断。

それらは `docs/` 直下、`docs/ai-driven-development/`、`apps/*/docs/` に置き、必要に応じて `docs/harness/rule-map.json` から参照します。
