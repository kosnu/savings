---
title: AI Driven Development Overview
doc_type: overview
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - codex-goal
  - prd
  - design-doc
when_to_read:
  - AI駆動開発の目的と工程を確認するとき
  - Goal、成果物、Learnの関係を整理するとき
---

# AI Driven Development Overview

このリポジトリのAIDDは、目的、許可範囲、制約、検証可能な完了条件、停止条件をGoalとして固定し、agentがその範囲で自律実行する開発方式です。

工程は次の4つです。

1. Intent / Requirements: 最新Issue本文から達成内容と成功条件を定義する。
2. Design / Plan: 検証済みRequirements全体から実装・検証方針を定義する。
3. Build / Verify: Designに従って実装し、要求充足と対象appの検証を完了する。
4. Ship: 検証済み成果をcommit、PR、説明、review対応可能なdelivery状態にする。

前工程ほどユーザー課題と成功条件を扱い、後工程ほど実装とdeliveryを扱います。各工程は独立したGoalであり、直前工程の完了証拠を入力にします。

RequirementsとDesignはJSONを機械正本、生成Markdownを人間向け表示とします。cycle-start Issue titleはRequirementsだけが型付きfieldとして所有し、Design以降はRequirementsのhashまたはDesign completion receiptで同じcycleを参照します。machine gateは安定ID、所有者、role、reference、status、hashで完全性と連続性を判定します。Designはproduct behaviorをcanonical Requirementだけが所有するtyped inventoryで定義し、実装予定のmachine review surfaceを構造化して所有します。完了時は完全なDesign Goal・Issue・rule map・最終selected rule文書・成果物・Build基準Git `HEAD`を同じbyte snapshotから検証してreceiptでBuildへ固定します。Buildはその基準点から実差分surfaceとpathに一致するrule nodeを再計算し、Design coverageを超える経路を失敗させます。文章の言い回しや自己申告rule一覧を機械IDの代わりにしません。

人間は各細手順を承認するgatekeeperではなく、Task Contextと制約を管理し、Stop時の判断と公開権限を担います。Issueの書き方は[issue-guidelines.md](./issue-guidelines.md)、工程契約は[workflow.md](./workflow.md)、Goal構築項目は[goal-templates](./goal-templates/index.md)を参照します。

レビュー、検証、運用から得たfindingは自動でRequirementsへ混ぜません。ユーザーがLearnを実行してIssue本文またはrule/policyの変更案へ整理し、Issueへ適用された内容だけが次サイクルのRequirements Task Contextになります。
