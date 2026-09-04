---
title: Adopt AIDD Invariant Protocol
doc_type: adr
status: accepted
area: repository
applies_to:
  - docs/ai-driven-development
  - docs/harness
  - tools/aidd
  - .codex
topics:
  - ai-driven-development
  - guardrails
when_to_read:
  - AIDD Coreとagent adapterの責務を変更するとき
---

# Adopt AIDD Invariant Protocol

## Status

Accepted 2026-09-05. ユーザーが採用したvNext設計に基づく。

## Context

旧AIDDは要求混入、判断の事後変更、検証漏れを工程Goalと固定executorで防いでいた。
schema v4の完成状態、ownership、rule closure、runner、snapshot、staged gateは有用だが、
工程の手順をagent/modelに固定することはそれらの保証の必要条件ではない。

## Decision

vendor-neutral Task / Decision / Checkpoint / EvidenceをCoreとする。
DevelopmentはIssue指定の実行依頼に自動適用し、Codexでは1 Goalで継続する。
探索・要求理解・設計は反復可能とし、checkpointを追記型revisionで改訂する。
baselineを保持し、decision改訂と対象変更で古い証拠を失効させる。
LearnはIssue不要の独立guardrail更新として検証・review・確定まで完了する。
Goal、Hooks、modelと委譲はadapterへ分離する。

ADR 0001の薄い入口・記録・機械的guardrailを継承する。ADR 0002のMarkdown正本と依存graphを
継承し、hard routingをpath/surfaceと実差分で決定する。探索metadataを強制条件にしない。
ruleの意味はMarkdown、適用と検証接続はrule-map/contract、実行検査はcheckerが所有する。
priorityで適用ruleを除外しない。

ADR 0002の2026-08-23 Clarificationのうち、Designでの手動additional_rules固定、
Build receipt、別Coverage recordに結び付いた実行方式を本Decisionで置き換える。
path固有ruleの和集合と依存closureという不変条件は維持し、checkpoint生成と実差分検査が自動計算する。

## Consequences

旧phase実行入口は廃止する。旧artifactは履歴として残し、新しい証拠へ昇格させない。
独立したLearnでも開始時checker、旧policy/profile、明示許可、独立reviewを必要とする。
初期版は専用worktreeの単一writer、全証拠失効、1 PR=1 taskを維持する。
意味的な正しさやreview権限はhashだけでは証明できず、agent/reviewerが責任を持つ。

## Clarification: Configuration ownership and continuation (2026-09-05)

混在設定はファイル単位の一括guardrail分類を用いず、JSON fieldとpnpm依存closureで
productと検証機構の境界を検査する。独立したVite build設定はproductとして扱う。
Task baselineの固定は検証対象差分の固定を意味し、task期間全体のHEAD等号を意味しない。
元baselineの子孫commitから同じTask/Goalで判断改訂・再検証・再Shipを行える。
初回bootstrapでも対象差分のmanifestに結合した独立review記録をCIで要求する。
