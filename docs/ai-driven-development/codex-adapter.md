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

Learnは独立したGoalを利用できる。未完了Development GoalをLearnへ流用しない。
Goalのactive/blocked/pausedの扱いはhostのtool契約に従う。Coreの中断を偽の完了へ変換しない。

model/reasoningは現在の選択を基本とし、特定modelへの委譲をCoreの前提にしない。
独立した調査・reviewが有用な場合だけsubagentへ有限scopeとtask/checkpoint/hashを渡す。
共有worktreeのwriterは1つ。並行実装は別worktreeを使い、統合後に再検証する。

Hooksはcompact後のinvariant再提示と、制御面変更の早期検査を担う。
Hookの成功や不発火をCoreの完了証拠へ変換しない。Goal/Hookなしでも同じCore検査が成立する。

CoreのSHA-256出力を次commandのexpected identityとして使用する。
Learnでは開始時にbuildしたbinaryを保持し、candidate binaryへ切り替えない。
Issueの内容変更を検知したらintentを黙って更新せず、権限・目的を確認して新taskとする。
