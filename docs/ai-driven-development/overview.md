---
title: AI Driven Development Overview
doc_type: guide
status: accepted
area: repository
applies_to:
  - docs/ai-driven-development
  - tools/aidd
  - apps
topics:
  - ai-driven-development
when_to_read:
  - AIDDの実行契約と責務を確認するとき
---

# AIDD vNext

AIDDはこのrepositoryのデフォルト開発プロトコルです。Issueまたはユーザーの明示発言を出典とする開発実行依頼は
Developmentへ入ります。質問、説明、調査、設計案の提示だけでは開始しません。

CoreはTask contract、Decision、checkpoint、検証証拠、ownership、rule coverage、
Shipの同一性を所有します。Goal、Hooks、model、subagentはCoreの必要条件ではありません。
Codexは1つのDevelopment Goalで探索から依頼されたdeliveryまで継続します。

DevelopmentはExplore / Decide → checkpoint → Build / Verify / Review → Shipを基本形とし、
設計判断を同じ意図・制約の下で改訂できます。改訂は新revisionとして記録し証拠を全失効します。
Learnはfeedbackの分析と改善です。既存作業中のルール保守は同じTaskで行い、単独の新規依頼ではTaskを開始できます。
Learn用Issueは作りません。product実装の意図と許可は出典となるIssueまたはユーザー発言で確認し、許可済みの作業を同じTaskで継続します。
人間のIntentとIssueなどの表現方法は区別します。意図の補足・訂正は同じTaskのcheckpointへ出典付きで追記し、
元の記録を保持します。既存Taskの続行と独立した新規作業の境界はworkflowに従います。

契約の正本は[workflow](workflow.md)、checker境界は[aidd-checker](aidd-checker.md)、
実行方法は[operations](aidd-checker-operations.md)、Codex固有動作は[codex-adapter](codex-adapter.md)です。
