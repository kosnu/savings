---
title: Define AIDD Task and cycle boundary
doc_type: adr
status: accepted
area: repository
applies_to:
  - docs/ai-driven-development
  - docs/harness
  - tools/aidd
  - .agents
topics:
  - ai-driven-development
  - task-scope
  - learning
when_to_read:
  - Task・サイクル・Learnの開始と継続を判断するとき
---

# ADR-0008: Taskと開発サイクルの境界を一致させる

## Context

[Issue #1807](https://github.com/kosnu/savings/issues/1807)とPRレビューで、
用語定義がworkflowなどに点在し、Taskとサイクルの対応、指摘のない場合のLearn、
独立したLearn Taskの可否に相反する解釈が生じた。

## Decision

一つのTaskを、一つのIntentから始まる一つの開発サイクルの実行記録とする。
DevelopmentとShipの後、対象となる指摘があれば同じTask内でLearnし、採用した学びを反映する。
指摘がなければLearnは行わない。同じ成果への修正・再試行・追加Shipは元のTaskで続ける。
サイクルを終えた後の新しいIntentは次のTask・サイクルを開始する。
feedbackだけを出典とする独立したLearn Taskは新規作成しない。

用語定義は[AIDDプロトコル用語集](../ai-driven-development/glossary.md)を正本とし、
[workflow](../ai-driven-development/workflow.md)は実行条件を所有する。
既存のTask ID例の`cycle-1`は識別用の文字列として維持し、サイクル境界の機械的判定には使わない。

本DecisionはADR-0003の独立Learn判断、ADR-0004の単独依頼から新Taskを開始できる判断のうち
feedbackのみの依頼に関する部分、ADR-0006のIssueなしLearnを新規Taskの入口とする前提を置き換える。
ADR-0004の1 PRに複数Taskを認める判断、作業種別だけでブランチやPRを分けない判断、
ADR-0006のIssue以外のIntent出典とcheckpointによる補足記録は維持する。

## Consequences

新規`task-start`は`kind: learn`を拒否する。旧`kind: learn` Taskは当時の契約による
履歴として読み取り・継続し、記録やhashを変更しない。
現在の入口と関連文書はこの境界に揃える。採択済みADRの旧本文は履歴として保持する。
