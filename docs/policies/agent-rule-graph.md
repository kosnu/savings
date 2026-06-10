---
title: Agent Rule Graph
doc_type: policy
status: draft
area: repository
applies_to:
  - AGENTS.md
  - CLAUDE.md
  - docs
  - apps/web/docs
  - apps/api/docs
topics:
  - agent-guidance
  - documentation
  - front-matter
  - harness-engineering
  - rule-graph
  - guardrails
when_to_read:
  - AI agentが参照するルール体系を設計または更新するとき
  - AGENTS.mdやCLAUDE.mdを薄い入口として整理するとき
  - ルール、ADR、設計判断、運用方針の参照漏れを減らしたいとき
---

# Agent Rule Graph

この文書は、Codex、Claude Code、Cursor などの AI agent に、プロジェクト内のルール、ADR、設計判断、運用方針を効率よく参照させるための考え方をまとめます。

目的は、すべてのドキュメントを agent に読ませることではありません。現在の作業対象や相談内容から、読むべき文書だけを選び、必要な依存関係をたどり、なぜその文書を参照したのか説明できるようにすることです。

この文書は、リポジトリ内の `docs/` を agent が辿れる記録システムとして扱う方針のうち、ルール、ポリシー、ADR、設計判断の選択に関する下位設計です。前提となる考え方は [Harness Engineering Notes](../ai-driven-development/harness-engineering.md) にまとめます。

## 位置づけ

この仕組みは RAG や GraphRAG ではありません。

RAG は、大量の文書から関連しそうな情報を検索し、LLM の入力に渡す仕組みです。GraphRAG は、その検索精度を上げるためにグラフ構造を使う技術です。

このリポジトリで最初に必要なのは、未知の関連情報を発見する検索基盤ではなく、人間が明示的に管理するルール選択の仕組みです。

そのため、初期設計では GraphRAG や Neo4j のような仕組みを導入せず、Markdown、front matter、軽量な索引で deterministic document retrieval を行います。

`rule-map.json` は知識ベースそのものではありません。`docs/` に置かれた正本へ agent を案内するための補助索引です。

## 基本方針

- `AGENTS.md`、`CLAUDE.md`、Cursor 用ルールなどは薄い入口にする。
- ルール、方針、設計判断、計画、参照情報の正本は Markdown に置き、人間が読みやすい形で保守する。
- agent が読むべき文書を選ぶためのメタデータは、front matter または `rule-map.json` のような軽量な索引に置く。
- ルール間の依存、上書き、優先度を明示し、参照漏れと誤適用を減らす。
- agent は、選んだルールと選択理由を説明できる状態で作業する。
- 複数の agent から同じルール体系を参照できるよう、agent 固有ファイルへルール本文を重複させない。
- ドキュメントで守らせるには弱い不変条件は、lint、CI、tests、scripts へ昇格する。

## ルールグラフで扱う情報

ルールマップは、ルール本文そのものではなく、読むべきルールを決めるためのルーティング情報を持ちます。

代表的な項目は次のとおりです。

- `id`: 安定したルールID。
- `file`: 実際に読むべき Markdown ファイル。
- `applies_to`: 適用対象。path、directory、domain、feature、activity、topic などを含める。
- `depends_on`: このルールを正しく適用するために前提として読むルール。
- `overrides`: 同じ論点でこのルールが上書きするルール。
- `priority`: 明示的な上書き関係がない場合の競合解決補助。

`priority` だけで競合を解決しようとしてはいけません。基本的には、より具体的な適用範囲、明示的な `overrides`、`priority` の順に解決します。それでも曖昧な場合は agent が止まり、人間に確認します。

## docsナレッジベースとの関係

この文書でいうルールグラフは、`docs/` 全体を置き換えるものではありません。

`docs/` は、人間と agent が共有する記録システムです。そこには、ルールだけでなく、ドメイン仕様、アーキテクチャ、ADR、実行計画、生成されたスキーマ参照、品質や信頼性の記録も含まれます。

ルールグラフは、そのうち作業時に参照漏れや競合が起きやすい文書群を、agent が段階的に辿るための索引として扱います。

したがって、最初からすべての `docs/` をノード化する必要はありません。まずは、誤適用が痛いポリシー、依存関係があるADR、作業対象ごとに読むべき設計判断から始めます。

## ルール選択の流れ

agent は作業開始時に、現在の依頼を path、domain、activity、topic へ分類します。

その分類をもとに、ルールマップから候補ルールを選びます。候補ルールが見つかったら、`depends_on` をたどって前提ルールを追加します。競合がある場合は `overrides` と `priority` で整理します。

最終的に agent が読むのは、選択されたサブグラフに含まれる Markdown だけです。

agent は作業や回答の中で、必要に応じて次を説明します。

- どの作業分類に基づいてルールを選んだか。
- どのルールを読んだか。
- どの依存ルールを追加で読んだか。
- 競合がある場合、どのルールを優先したか。
- 曖昧さが残る場合、何が未決か。

## 毎回読むルールと必要時だけ読むルール

毎回読む入口ルールは、最小限にします。

毎回読むべきものは、言語、破壊的操作の禁止、ユーザー確認が必要な条件、ドキュメント探索の手順、ルールマップの使い方など、すべての作業に関わる不変条件です。

一方で、Web component 構造、DB migration、ADR、PRレビュー対応、Storybook、特定ドメインの仕様などは、作業内容に応じて必要時だけ読みます。

入口ファイルに大量の個別ルールを直接書くと、agent ごとの差分が広がり、人間にとっても保守しにくくなります。入口ファイルは、ルール本文ではなくルール選択プロトコルを持つべきです。

入口ファイルは、毎回読む短い目次です。詳細な判断理由、背景、例外、関連文書は `docs/` に置きます。

## 粒度

ルールは、作業時に一緒に適用される判断単位で分けます。

細かすぎるルールは、agent が多数の小さな文書を読む必要を生み、依存関係も壊れやすくなります。大きすぎるルールは、関係ない内容まで読み込ませ、誤適用を増やします。

目安として、1つのルール文書は、1つの判断領域に対して読み切れる分量にします。

例:

- Web component structure policy
- DB migration policy
- ADR writing policy
- Git workflow policy
- Review feedback classification policy
- Domain-specific UI policy

複数の責務にまたがる内容は、1つの文書にまとめず、責務ごとに分けて相互リンクします。

## ファイルパターン選択の限界

path や glob は強力な選択条件ですが、それだけでは十分ではありません。

同じファイルでも、変更内容によって参照すべきルールは変わります。たとえば TSX ファイルへの変更でも、表示調整、component 抽出、テスト追加、design system 変更では必要なルールが異なります。

そのため `applies_to` は path だけでなく、domain、activity、topic を併用します。

例:

```json
{
  "id": "web.component-structure",
  "file": "apps/web/docs/policies/component-structure.md",
  "applies_to": {
    "paths": ["apps/web/src/**/*.tsx"],
    "activities": ["add_component", "move_component", "extract_component"],
    "domains": ["web", "ui"],
    "topics": ["component-structure"]
  },
  "depends_on": [],
  "overrides": [],
  "priority": 80
}
```

## 複数 agent での共通化

Codex、Claude Code、Cursor などで共通化する場合、各 agent 固有の入口ファイルには、その agent がどうルールマップを読むかだけを書きます。

共通のルール本文と索引は、リポジトリ内の通常のドキュメントとして管理します。

推奨する責務分担:

- `AGENTS.md`: Codex 向けの入口と必須不変条件。
- `CLAUDE.md`: Claude Code 向けの入口と必須不変条件。
- Cursor 用ルール: Cursor 向けの入口と必須不変条件。
- `docs/**/*.md`: 人間と agent が読むルール本文。
- `rule-map.json`: agent が読むルール選択用の索引。

agent ごとに同じルール本文を複製してはいけません。重複すると、更新漏れや解釈差分が発生します。

## ドキュメントから機械的ガードレールへの昇格

Markdown のルールは、agent の判断を助けるためのものです。明確に検出できる不変条件を Markdown だけに置き続けると、遵守は agent の注意力に依存します。

次に該当する場合は、ドキュメントから機械的な検証へ昇格します。

- 違反条件を lint、型、テスト、script、CI で検出できる。
- 同じ review feedback が繰り返される。
- agent が誤った既存パターンを複製しやすい。
- 逸脱がアーキテクチャ境界、データ境界、権限、セキュリティ、検証信頼性に影響する。

昇格後も、なぜそのガードレールが存在するかは `docs/` に残します。機械的チェックは強制力を持ち、Markdown は判断理由と例外を説明します。

## GraphRAG が必要になる境界

GraphRAG やグラフデータベースが必要になるのは、明示的なルールマップでは扱いにくい知識探索が主目的になったときです。

たとえば、次の状況では検討価値があります。

- ルール、ADR、Issue、PR、設計履歴、コードコメントを横断して関連判断を探したい。
- ファイルパターンや明示タグでは拾えない概念的な関連が多い。
- 過去の類似判断を意味検索したい。
- ルールやADRが数百以上になり、人間が関係を明示管理しきれない。
- 複数リポジトリや複数チームの知識を横断したい。

ただし、ガードレールとして必ず読ませたいルールを決める用途では、GraphRAG を主役にしません。ルール適用は、できるだけ明示的で決定的な探索に寄せます。

## 過剰設計のライン

次に該当する場合は過剰設計を疑います。

- ルール数が少ない段階でグラフデータベースを導入する。
- ルール本文よりメタデータのほうが複雑になる。
- 人間が手で更新できない形式を正本にする。
- `depends_on` や `overrides` が多すぎて、読むべきルール集合が予測できない。
- `priority` の数値調整で実質的な仕様判断を隠す。
- 入口ファイル、ルールマップ、Markdown の三者に同じ意味のルールを重複させる。
- `docs/` のナレッジベース全体を、必要性がないまま完全なグラフへ変換しようとする。
- agent の説明責任より、自動選択の巧妙さを優先する。

初期段階では、Markdown、front matter、軽量なルールマップ、簡単な検証で十分です。

## 保守

ルールマップを導入する場合は、少なくとも次を検証できるようにします。

- `file` が存在する。
- `depends_on` と `overrides` の参照先が存在する。
- 意図しない循環依存がない。
- `priority` が許容範囲に収まっている。
- `status: deprecated` の文書が現在方針として選択されない。
- 同じ適用範囲に高優先度の競合ルールがない。

恒常ドキュメントでは、front matter を探索用メタデータとして維持します。強制ルールは `AGENTS.md` に置き、詳細な判断基準や背景は Markdown 本文に置きます。
