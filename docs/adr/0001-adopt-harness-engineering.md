---
title: Adopt Harness Engineering
doc_type: adr
status: accepted
area: repository
applies_to:
  - AGENTS.md
  - docs
  - docs/harness
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - agentic-coding
  - documentation
  - guardrails
  - harness-engineering
when_to_read:
  - AI agent向けのリポジトリ構造やドキュメント体系を設計するとき
  - AGENTS.mdを肥大化させずdocsへ誘導する方針を確認するとき
  - docs/harnessの責務を確認するとき
---

# Adopt Harness Engineering

## Status

Accepted.

## Context

AI agent に有用な作業を任せるには、作業指示だけでなく、入口、記録、ガードレール、検証手段をリポジトリ内に整える必要がある。

巨大な `AGENTS.md` に全ルールを集約すると、context を圧迫し、優先順位が曖昧になり、古いルールが残りやすい。詳細な判断基準は、agent と人間が共有できる `docs/` に置き、入口から段階的に辿れる必要がある。

参考:

- [ハーネスエンジニアリング：エージェントファーストの世界における Codex の活用](https://openai.com/ja-JP/index/harness-engineering/)

## Decision

このリポジトリでは、AI agent が作業するための入口、記録、ガードレール、検証手段をハーネスとして扱う。

- `AGENTS.md` は、毎回読む薄い目次にする。
- `docs/` は、人間と agent が共有する記録システムにする。
- `docs/harness/` は、agent が作業時に参照するガードレール文書と索引を置く場所にする。
- `docs/harness/rule-map.json` は、作業対象から読むべき Markdown を選ぶための補助索引にする。
- ハーネスエンジニアリングやルールグラフの採用判断は ADR に記録する。
- ドキュメントだけでは守りにくい不変条件は、lint、CI、tests、scripts へ昇格する。

## Consequences

- `docs/harness/` には、agent が作業時に守る policy、rule、domain constraint と、それらを選ぶための索引を置く。
- 個別機能の PRD、Design Doc、作業ログは `docs/ai-driven-development/` に残す。
- アプリ固有の component、UI、test、React Query などの実装方針は `apps/*/docs/` に残す。
- `docs/harness/rule-map.json` は、`docs/harness/` 以外の文書も参照してよい。
