---
title: Adopt Agent Rule Graph
doc_type: adr
status: accepted
area: repository
applies_to:
  - AGENTS.md
  - CLAUDE.md
  - docs
  - docs/harness
  - apps/web/docs
  - apps/api/docs
topics:
  - agent-guidance
  - documentation
  - front-matter
  - rule-graph
  - guardrails
when_to_read:
  - AI agentが参照するルール体系を設計または更新するとき
  - AGENTS.mdやCLAUDE.mdを薄い入口として整理するとき
  - ルール、ADR、設計判断、運用方針の参照漏れを減らしたいとき
---

# Adopt Agent Rule Graph

## Status

Accepted.

## Context

AI agent にすべてのドキュメントを毎回読ませると、context を圧迫し、関係ないルールの誤適用が増える。一方で、path や front matter だけでは、ルール間の依存、上書き、競合優先度を扱いにくい。

そのため、作業対象から読むべき文書を決定的に選ぶ仕組みが必要である。

## Decision

このリポジトリでは、agent が読むべきルール、ポリシー、ADR、設計判断を選ぶために、軽量なルールグラフを採用する。

- 正本は Markdown に置く。
- `docs/harness/rule-map.json` は、Markdown 正本へ案内する補助索引として扱う。
- `rule-map.json` は `id`, `file`, `applies_to`, `depends_on`, `overrides`, `priority` を持つ。
- agent は依頼を `path`, `domain`, `activity`, `topic` に分類し、該当するサブグラフだけを読む。
- `depends_on` で前提文書を追加し、`overrides` と `priority` で競合を整理する。
- 曖昧さが残る場合は、agent が止まり、人間に確認する。

## Consequences

- `AGENTS.md` や agent 固有入口ファイルには、ルール本文ではなく探索手順を置く。
- `docs/harness/rule-map.json` の `file` は、`docs/harness/` 以外の正本文書も参照できる。
- すべての `docs/` を最初からノード化しない。まずは、誤適用が痛いポリシー、依存関係があるADR、作業対象ごとに読むべき設計判断から索引化する。
- `priority` だけで仕様判断を隠さない。解決できない競合は人間に確認する。
- 機械的に検出できる不変条件は、Markdown だけに置かず lint、CI、tests、scripts へ昇格する。
