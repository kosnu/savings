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
旧版のStop/SessionStart hookによるTask推論・状態管理と、Goal本文からのTask推論を実行経路にしない。

## コンパクション後の案内

リポジトリの`SessionStart` Hookは`source=compact`のときだけ、コンパクション後に明示されたTask IDからCoreの`status`と
最新checkpointを読み直す短い案内を`additionalContext`として返す。自動・手動のコンパクションを同じ条件で扱う。Task IDの推論、状態の保存、検証の実行、
作業継続の強制は行わない。Hookの出力はIntent、判断、証拠の正本ではない。
Hookが未信頼、無効、または失敗しても、上記の再開手順を通常どおり実行する。
