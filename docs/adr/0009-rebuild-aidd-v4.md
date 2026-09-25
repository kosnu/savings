---
title: ADR 0009: AIDD v4を再構築する
doc_type: adr
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
topics:
  - ai-driven-development
  - aidd-v4
when_to_read:
  - ADR 0009: AIDD v4を再構築するを判断または変更するとき
---

# ADR 0009: AIDD v4を再構築する

## Context

Issue [#1815](https://github.com/kosnu/savings/issues/1815)は旧AIDD基盤の白紙化と、Intentから
Ship、Audit、手動承認後の改善までのagent-firstなサイクルを求める。
旧phase、schema、checker、adapterの継承や互換層は制約に反する。
主要手法の[比較](../ai-driven-development/research-v4.md)では、永続状態と観測は有用だが、
固定手順や多agent構成は環境・modelに依存する。

## Decision

新しい[AIDD v4](../ai-driven-development/workflow.md)とGo Coreを唯一の実行契約にする。
旧Coreコード・CLI・contract・hookを現行経路から除き、旧データを読むfallbackを置かない。
v4は製品名であり、旧schema番号との連続性を意味しない。

Intentと意味評価はagentが扱い、機械的な証拠の鮮度・状態・承認範囲はGoで検査する。
確定したTaskと判断を保持し、新revisionで変更する。検証済みcontent/modeとstageを照合してShipする。
Goalはhostの任意機能とし、親agentが所有する。Coreには依存させない。
Ship後にAuditを行い、具体的提案への手動承認後だけ同じTask内で改善を実施する。

この判断はADR 0003、0004、0005、0006、0007、0008のAIDD固有契約を置き換える。
ADR 0001・0002のharnessとrule graph、およびリポジトリのdomain/policyは引き続き適用する。
採択済みADR、過去のTask・checkpoint・証拠は履歴として保存し、現行実行の入力にはしない。

## Consequences

旧Taskのデータ変換や継続実行をv4は提供しない。履歴の閲覧はGitと記録そのもので行える。
移行のための旧Core互換運用を追加せず、このIssueの開始Intent・baselineと判断履歴をv4の記録として残す。
新Coreはローカルの信頼されたagentと単一writerを前提とする。自己申告した承認の真正性や
意味評価を暗号学的に認証するものではない。hostのユーザー権限境界と人間レビューが必要である。
checker自体の変更は自身の成功だけで正当化せず、負の境界テスト、差分レビュー、CIで確認する。

固定工程を削減する代わりに、agentが成果・未達・証拠不足を具体的に判断する責任を持つ。
Audit後の承認待ちはサイクル完了を遅らせ得るが、無承認の自己改変より優先する。
