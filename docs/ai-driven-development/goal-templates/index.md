---
title: AI Driven Development Goal Templates
doc_type: template
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - codex-goal
  - templates
when_to_read:
  - Codex Goalのテンプレート一覧を確認するとき
  - AI駆動開発の各工程に対応するGoalテンプレートを選ぶとき
---

# AI Driven Development Goal Templates

必要なGoalだけコピーして使うためのテンプレート集です。

非自明なGoalを作る場合は、テンプレート本文を長くコピーするのではなく、[../workflow.md](../workflow.md) のContext Packetに入力を圧縮します。探索や要約が必要な場合も、長い調査ログではなく、選択した参照、制約、リスク、Stop条件だけをGoalに残します。

工程順序、各工程の責務、成果物境界、ShipとLearnの扱いは [../workflow.md](../workflow.md) を正本とします。各テンプレートはGoal構築用のチェックリストであり、workflowを再定義しません。

- [Intent / Requirements Goal](./intent-requirements-goal.md)
- [Design / Plan Goal](./design-plan-goal.md)
- [Build / Verify Goal](./build-verify-goal.md)
- [Ship Goal](./ship-goal.md)

レビューコメント、検証結果、運用知見、ルール・ポリシー変更を次回Requirementsの入力へ整理する場合は、Goalテンプレートではなく `$learn` skill を使います。
