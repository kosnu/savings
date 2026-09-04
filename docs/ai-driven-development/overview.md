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

AIDDはこのrepositoryのデフォルト開発プロトコルです。Issueを指定した開発依頼は
Developmentへ入ります。質問、説明、調査、設計案の提示だけでは開始しません。

CoreはTask contract、Decision、checkpoint、検証証拠、ownership、rule coverage、
Shipの同一性を所有します。Goal、Hooks、model、subagentはCoreの必要条件ではありません。
Codexは1つのDevelopment Goalで探索から依頼されたdeliveryまで継続します。

DevelopmentはExplore / Decide → checkpoint → Build / Verify / Review → Shipを基本形とし、
設計判断を同じ意図・制約の下で改訂できます。改訂は新revisionとして記録し証拠を全失効します。
Learnはfeedbackから独立して開始し、guardrailの変更・検証・確定で終了します。
Learn用Issueを作らず、product実装が必要なら既存Issueから別Developmentを開始します。

契約の正本は[workflow](workflow.md)、checker境界は[aidd-checker](aidd-checker.md)、
実行方法は[operations](aidd-checker-operations.md)、Codex固有動作は[codex-adapter](codex-adapter.md)です。
