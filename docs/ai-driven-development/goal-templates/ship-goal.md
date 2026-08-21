---
title: Ship Goal Template
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
  - pull-request
  - delivery
when_to_read:
  - Ship Goalを構築するとき
---

# Ship Goal

## Goalへ含める情報

- 目的: Build / Verify済み成果を要求されたdelivery状態にする。
- Cycle identity: Issue、workspace、branch、Requirements・DesignのhashとDesign completion receipt。cycle-start titleはRequirements所有値を参照し、Ship入力として再指定しない。
- Build evidence: 現在diffに対応するverification結果。
- Delivery target: commit、remote branch、base branch、PR、review threads。
- Scope: 含めるdiff、除外するdiff、許可されたGitHub操作。
- Rule selection: git workflow、PR、review、CIに関するpolicy。
- Stop条件: target、authority、diff、CI、review stateの曖昧さ。

## Done / Verification

- dependency-closedな対象diffだけがcommitされている。
- 要求されたpushとopen PR作成または更新が完了している。
- PR本文がIssue、変更内容、verification、残riskを正確に説明する。
- 許可されたreview replyと、fully addressed threadのResolveが完了している。
- 報告直前にGit、PR、CI、review thread状態を再取得している。

ShipはBuild成果を公開可能な形へ整える工程です。実装変更が必要になった場合、古いBuild verificationを流用せず停止します。LearnはShip完了後にユーザーが別途実行します。
