---
title: AIDD v4 Codex adapter
doc_type: policy
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
topics:
  - ai-driven-development
  - aidd-v4
when_to_read:
  - AIDD v4 Codex adapterを判断または変更するとき
---

# AIDD v4 Codex adapter

Codexは[共通workflow](workflow.md)を実行する。host固有のGoalや会話要約をCoreの入力契約へ持ち込まない。

## Goal機能との接続

Goalの作成可否と状態更新は、そのhostが公開するtoolの条件に従う。
作成に明示依頼が必要なhostでは、開発の実行依頼だけからGoalを作成しない。
既存Goalが同じTaskのものであれば親agentが所有・継続する。subagentにGoalの作成・完了を委譲しない。
GoalなしでもTaskの記録・検証・レビュー・Ship・Auditを実施する。

Goalには成果、Intentの参照、Task ID、完了条件を短く記す。Taskの判断やログ全文を複製しない。
予算を勝手に設定せず、ユーザーによるpauseやhostの制限を尊重する。
Audit未実施・改善承認待ちをサイクル完了としてGoalへ反映しない。

## 再開

明示したTask IDからCoreのstatusを取得し、開始Intent、最新decision/checkpoint、検証・review・
Ship・Audit・承認記録を必要な範囲で読む。前の会話の要約だけを証拠として扱わない。
旧版のStop/SessionStart hookやGoal本文からのTask推論を実行経路にしない。
