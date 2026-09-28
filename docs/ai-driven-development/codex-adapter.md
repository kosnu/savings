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
  - git
  - sandbox
when_to_read:
  - AIDD v4 Codex adapterを判断または変更するとき
  - CodexでGit管理領域へ書き込むとき
---

# AIDD v4 Codex adapter

Codexは[共通workflow](workflow.md)を実行する。host固有のGoalや会話要約をCoreの入力契約へ持ち込まない。

## Git管理領域への書き込み

Git操作の対象・権限・安全条件は[Git Workflow](../harness/policies/git-workflow.md)に従う。
実行前に`git rev-parse --git-common-dir`と`git rev-parse --git-dir`で管理領域を確認し、
hostが示す書き込み境界・保護対象と照合する。worktree本体や親directoryが書き込み可能でも、
`.git`やworktree固有の管理領域まで書き込み可能とは限らない。

管理領域が保護されている場合、そこへ書き込む`git add`、`git commit`、`git fetch`、
branch作成・切り替えなどは、初回から`exec_command`の`sandbox_permissions: "require_escalated"`で要求する。
通常実行で権限エラーを起こすことを昇格要求の前提にしない。`git push`もlocalのtracking ref等を
更新するため、remote操作だけとみなさず同じ判定を行う。

Codexのrulesによるコマンドの許可と、サンドボックス内のファイル書き込み制限は別に判断する。
既存rulesで許可されていても、通常実行で保護対象へ書き込めるとは解釈しない。
昇格要求は既存rulesとhostの承認判定に従い、必要なコマンドと対象に限定する。
昇格が禁止されているhostや要求が拒否された場合は、その制限を迂回せず停止理由を報告する。
この方針を理由にサンドボックス全体を無効化したり、包括的な許可ruleを追加したりしない。

`git diff`、`git log`、`git show`、`git rev-parse`などの読み取りは、Git管理領域の保護だけを理由に
一律に昇格しない。保護対象へ書き込まない操作は通常の実行経路を使い、別の制約がある場合は個別に判断する。

参考: OpenAI公式の[Sandbox](https://learn.chatgpt.com/docs/sandboxing)と
[Rules](https://learn.chatgpt.com/docs/agent-configuration/rules)（2026-09-28確認）。

## Goal機能との接続

Goalの作成可否と状態更新は、そのhostが公開するtoolの条件に従う。
作成に明示依頼が必要なhostでは、開発の実行依頼だけからGoalを作成しない。
既存Goalが同じTaskのものであれば親agentが所有・継続する。subagentにGoalの作成・完了を委譲しない。
GoalなしでもTaskの記録・検証・レビュー・Shipまで実施する。AuditはShip後の明示依頼を受けて実施する。

Goalには成果、Intentの参照、Task ID、完了条件を短く記す。Taskの判断やログ全文を複製しない。
予算を勝手に設定せず、ユーザーによるpauseやhostの制限を尊重する。
Shipを目的とするGoalの完了とサイクル完了を区別する。Audit未実施・改善承認待ちをサイクル完了としてGoalへ反映しない。

## 再開

明示したTask IDからCoreのstatusを取得し、開始Intent、最新decision/checkpoint、検証・review・
Ship・Audit・承認記録を必要な範囲で読む。前の会話の要約だけを証拠として扱わない。
旧版のStop/SessionStart hookやGoal本文からのTask推論を実行経路にしない。
