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

RequirementsとDesignはJSONを機械正本、生成Markdownを人間向け表示とします。新規サイクルはschema v4とAIDDワークフロー所有のrepo-local Go CLI `tools/aidd/checker`を使い、Designの`target_state`をtask-owned範囲の完成状態正本とします。`target_state`は実質的な最終効果descriptionを持つproduct behavior、verification case、ownership scope、machine-addressable representationを保持し、変更・削除の操作一覧は持ちません。automated verification caseは実行commandではなくrepo-owned profile IDとtyped selectorを持ち、fixed argvとrunner adapterはhash固定されるprofile catalogが所有します。Designは現在の実装を要求入力にせず、task-owned baseline inventoryとして完成状態との照合とrule選択にだけ使います。完了時は完全なDesign Goal・Issue・rule map・最終selected rule文書・成果物・target state・task-owned baseline inventory・非ignore untracked identity・Build基準Git `HEAD`・verification profile catalogをreceiptで固定し、Buildはその凍結済みbaselineを再検証に使います。Buildは既存実装へ差分を足すのではなくtarget stateだけを実体化し、task-owned範囲の未登録pathを不純物として失敗させます。verificationはautomated caseを専用process groupで実行し、残留processを終了・拒否してからignore対象を含むrepository mutationとGit stateをcase前後で比較します。locator metadataからsource構文やtest runner規則は推論しません。v2 / v3成果物はread-only履歴入力に限り、新しいGoal、Design completion、Build入力へ昇格しません。

人間は各細手順を承認するgatekeeperではなく、Task Contextと制約を管理し、Stop時の判断と公開権限を担います。Issueの書き方は[issue-guidelines.md](./issue-guidelines.md)、工程契約は[workflow.md](./workflow.md)、checkerの信頼境界は[aidd-checker.md](./aidd-checker.md)、Goal構築項目は[goal-templates](./goal-templates/index.md)を参照します。

レビュー、検証、運用から得たfindingは自動でRequirementsへ混ぜません。ユーザーがLearnを実行してIssue本文またはrule/policyの変更案へ整理し、Issueへ適用された内容だけが次サイクルのRequirements Task Contextになります。
