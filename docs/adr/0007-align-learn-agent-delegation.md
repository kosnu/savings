---
title: Align Learn agent delegation with common conditions
doc_type: adr
status: accepted
area: repository
applies_to:
  - docs/ai-driven-development
  - docs/harness
  - .agents
topics:
  - ai-driven-development
  - learning
  - delegation
when_to_read:
  - Learnの別agent委譲条件を判断または変更するとき
---

# ADR-0007: Learnの別agent委譲条件を共通基準に揃える

## Context

[Issue #1801](https://github.com/kosnu/savings/issues/1801)では、`AGENTS.md`の費用対効果に基づく委譲条件と、
[ADR-0003](0003-adopt-aidd-invariant-protocol.md)の2026-09-08 Clarificationに残る
「ユーザーの明示依頼がある場合だけ別agentへ委譲する」という判断の不一致が明らかになった。
独立reviewを必須にしないことと、別agentへの委譲を選べる条件は別の判断である。

## Decision

ADR-0003の2026-09-08 Clarificationのうち、別agentへの委譲をユーザーの明示依頼時だけに限る判断を置き換える。
Learnでも委譲の要否は`AGENTS.md`の費用対効果条件に従う。複雑で独立した作業の分担や重大なリスクの
独立検証で追加コストに見合う具体的な効果がある場合は、ユーザーの明示依頼を必須とせず、
必要最小限の担当範囲で別agentを選べる。定型的な確認、テスト結果の確認、軽微な修正はメインagentが行う。

担当agent自身が最新差分と検証証拠をreviewする責務と、独立reviewを必須にしない判断は維持する。
ユーザーの作業許可範囲、有限の担当範囲、単一writerの条件は変更しない。

## Consequences

ADR-0003は当時の判断の記録として保持する。現在適用する委譲条件は`AGENTS.md`と
[workflow](../ai-driven-development/workflow.md)などの現行文書が所有する。
本決定が置き換えるのはLearnの委譲条件に限り、ADR全体の参照・適用方法は変更しない。
