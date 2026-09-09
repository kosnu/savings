---
title: Codex AIDD Adapter
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

# Codex adapter

Coreの契約をCodexで実行する。Issue指定の開発依頼に自動適用し、質問・説明・調査では適用しない。

Developmentではtask objective/constraints/Done/verificationから1つのGoalを設定する。
最初にGoal toolの可用性と現在Goalを確認し、別taskの未完了Goalを置換しない。
Goalなしの場合も同じCore contractで継続し、Goal設定済みとは報告しない。
詳細hash、decision、progress、evidenceはrepositoryに保持し、Goal本文へ複製しない。
Goalをphaseごとに分割しない。Done未達や検証失敗を残してcompleteにしない。

既存成果へのShip依頼やreview修正では、task-startより先に既存Taskと対象PRを特定し、
[workflowの追加配信境界](workflow.md#追加配信とtaskの継続)を適用する。
Goalの終了や新しい会話はTask・baselineを作り直す理由にならない。
配信先を変えるagentの判断をユーザーのauthorizationへ書き足さず、既存Taskで続行できない場合は
失敗根拠と必要な境界変更を示す。checkerの成功だけを境界変更の許可根拠にしない。

Learnは独立したGoalを利用できる。未完了Development GoalをLearnへ流用しない。
Goalのactive/blocked/pausedの扱いはhostのtool契約に従う。Coreの中断を偽の完了へ変換しない。

model/reasoningは現在の選択を基本とし、特定modelへの委譲をCoreの前提にしない。
調査・実装・reviewは原則メインagentで行い、subagent利用はAGENTS.mdの費用対効果条件に従う。
委譲する場合は、有限scopeとtask/checkpoint/hashを渡す。
共有worktreeのwriterは1つ。並行実装は別worktreeを使い、統合後に再検証する。

Hooksはcompact後のinvariant再提示と、制御面変更の早期検査を担う。
Hookの成功や不発火をCoreの完了証拠へ変換しない。Goal/Hookなしでも同じCore検査が成立する。

CoreのSHA-256出力を次commandのexpected identityとして使用する。
Learnでは開始前にprepareで取得したbinaryを保持し、candidate binaryへ切り替えない。
取得手順は [AIDD checker operations](aidd-checker-operations.md#開始時のbinary) に従う。
Issueの内容変更を検知したらintentを黙って更新せず、権限・目的と新しい作業の境界を確認する。
追加配信では既存Taskの継続境界を優先し、内容変更だけを新taskの根拠にしない。
