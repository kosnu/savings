---
title: Harness Engineering Notes
doc_type: reference
status: draft
area: repository
applies_to:
  - AGENTS.md
  - docs
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - agentic-coding
  - codex
  - documentation
  - guardrails
  - harness-engineering
when_to_read:
  - AI agent向けのリポジトリ構造やドキュメント体系を設計するとき
  - AGENTS.mdを肥大化させずdocsへ誘導する方針を確認するとき
  - agentが自律的に検証、レビュー、修正できる環境を整えるとき
---

# Harness Engineering Notes

この文書は、OpenAI の「ハーネスエンジニアリング：エージェントファーストの世界における Codex の活用」から、このリポジトリの AI 駆動開発に関係する考え方を抽出します。

参照元:

- [ハーネスエンジニアリング：エージェントファーストの世界における Codex の活用](https://openai.com/ja-JP/index/harness-engineering/)

## 基本認識

AI agent による開発では、人間の主な仕事はコードを直接書くことから、agent が有用な作業をできる環境、意図、制約、フィードバックループを設計することへ移ります。

agent が苦戦している場合は、単に追加指示を出すのではなく、不足しているものを観察します。不足しているものは、ツール、抽象化、検証手段、ガードレール、ドキュメントのいずれかとしてリポジトリへ戻します。

## AGENTS.mdは目次にする

大きな `AGENTS.md` にすべてを書く方針は避けます。

巨大な入口ファイルは、次の問題を起こします。

- context を圧迫し、タスクや関連ドキュメントの余地を減らす。
- すべてが重要に見え、agent が優先順位を失う。
- 古いルールが残りやすく、人間も更新しなくなる。
- coverage、freshness、ownership、cross-link のような機械的な検証が難しい。

`AGENTS.md` は百科事典ではなく、短く安定した目次として扱います。毎回読むべき不変条件、作業入口、探索手順、参照先だけを置きます。

## docsは記録システムにする

リポジトリ内の `docs/` は、人間だけの補助資料ではなく、agent が作業中に辿れる記録システムとして扱います。

外部のチャット、口頭合意、個人の記憶、未整理のGoogle Docsにある知識は、agent から見えません。agent に使わせたい判断、設計、方針、制約、計画、検証結果は、バージョン管理されたリポジトリ内の成果物として残します。

このリポジトリでは、少なくとも次を `docs/` またはアプリ固有 docs の対象にします。

- product / domain specs
- architecture docs
- design docs / ADR
- execution plans
- generated schema references
- quality, reliability, security notes
- technical debt trackers
- agent-facing references

## 段階的開示

agent には、最初から大量の情報を読ませません。

短い入口から始め、現在の作業対象に応じて次に読むべき文書へ移動できるようにします。このためには、ドキュメント本文だけでなく、索引、相互リンク、front matter、必要なら `rule-map.json` のようなルーティング情報が必要です。

`rule-map.json` は、`docs/` 全体を置き換えるものではありません。agent が必要な文書を選ぶための補助索引です。

## 強い不変条件は機械化する

ドキュメントは agent の判断を助けますが、強制力には限界があります。

守らせたい不変条件が明確で、機械的に検証できる場合は、Markdown のルールに留めず、lint、CI、構造テスト、型、スクリプト、生成チェックへ昇格します。

例:

- アーキテクチャ境界を lint や構造テストで検出する。
- DB schema や generated docs の鮮度を CI で検証する。
- ドキュメントの cross-link、owner、status、front matter を lint する。
- 反復的な review feedback は、ドキュメント更新またはツール化へ戻す。

## 継続的な整備

agent が生成するコードやドキュメントは、既存パターンを増幅します。よいパターンも悪いパターンも増幅されるため、リポジトリには定期的な整備が必要です。

この整備は、人間が毎回手作業で行うのではなく、できるだけ検出、評価、修正 PR まで agent に任せられる形にします。

人間の役割は、どの原則を維持するか、どの逸脱を許容しないか、どの改善をリポジトリの仕組みに戻すかを決めることです。

## このリポジトリでの解釈

このリポジトリでは、OpenAIの記事を次のように解釈します。

- `AGENTS.md` は、毎回読む薄い入口とする。
- `docs/` は、人間と agent が共有する記録システムとする。
- `docs/policies/agent-rule-graph.md` は、docs のうちルール、ポリシー、ADR、設計判断を選択するための下位設計として扱う。
- `rule-map.json` のような仕組みは、RAGやGraphRAGではなく、段階的開示のための明示的な索引として扱う。
- ドキュメントだけでは守れない不変条件は、lint、CI、tests、scriptsへ昇格する。
