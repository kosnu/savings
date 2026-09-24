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

Coreの契約をCodexで実行する。Issueまたはユーザーの明示発言を出典とする開発実行依頼に自動適用し、質問・説明・調査では適用しない。

## Goal機能との接続

実行手順・フロー・プロトコルは[workflow](workflow.md)と[operations](aidd-checker-operations.md)が所有する。
GoalはそのTaskの目的と完了条件をCodex上で追跡するための機能であり、実行許可や正本状態を所有しない。
Goal操作の入口はこの対応関係を実際のtoolへ接続し、プロトコルを再定義しない。

Developmentではtask objective/constraints/Done/verificationから1つのGoalを設定する。
最初にGoal toolの可用性と現在Goalを確認し、別taskの未完了Goalを置換しない。
Goalなしの場合も同じCore contractで継続し、Goal設定済みとは報告しない。
詳細hash、decision、progress、evidenceはrepositoryに保持し、Goal本文へ複製しない。
Goalをphaseごとに分割しない。Done未達や検証失敗を残してcompleteにしない。
IntentからLearnで得た学びの反映までの[開発サイクル](workflow.md#概念とサイクルの境界)はGoalの識別単位ではない。
次のIntentから始まるサイクルでも、Task・Goalの新設や継続は目的と実行許可の境界で判断する。

既存成果へのShip依頼やreview修正では、task-startより先に既存Taskと対象PRを特定し、
[workflowの追加配信境界](workflow.md#追加配信とtaskの継続)を適用する。
Goalの終了や新しい会話はTask・baselineを作り直す理由にならない。
配信先を変えるagentの判断をユーザーのauthorizationへ書き足さず、既存Taskで続行できない場合は
失敗根拠と必要な境界変更を示す。checkerの成功だけを境界変更の許可根拠にしない。

同じTask内のルール保守では現在のGoalを継続する。単独Learn依頼のGoalはユーザーが求めた場合だけ作成する。
Goalのactive/blocked/pausedの扱いはhostのtool契約に従う。Coreの中断を偽の完了へ変換しない。
token budgetは明示された場合だけ設定する。Goal設定だけの依頼はTask実行を許可しない。
Goalを作成・確認した後も、作業の継続と完了は元のTask契約とユーザーの許可範囲に従う。

## その他のCodex接続

model/reasoningは現在の選択を基本とし、特定modelへの委譲をCoreの前提にしない。
調査・実装・reviewは原則メインagentで行い、subagent利用はAGENTS.mdの費用対効果条件に従う。
委譲する場合は、有限scopeとtask/checkpoint/hashを渡す。
共有worktreeのwriterは1つ。並行実装は別worktreeを使い、統合後に再検証する。

Hooksはcompact後のinvariant再提示と、制御面変更の早期検査を担う。
Hookの成功や不発火をCoreの完了証拠へ変換しない。Goal/Hookなしでも同じCore検査が成立する。

Coreのidentityは明示Task IDと期待revisionから解決する。通常はtask-statusと--latest / decision-updateを使い、詳細はoperationsに従う。既存のhash明示指定も保持する。
Learnでは開始前にprepareで取得したbinaryを保持し、candidate binaryへ切り替えない。
取得手順は [AIDD checker operations](aidd-checker-operations.md#開始時のbinary) に従う。
Issueの内容変更やユーザーの補足発言を受けたら、開始時Intentを上書きせず出典付きでcheckpointへ追記する。
要求との対応、実行許可、同じ成果への修正か独立した新規作業かをworkflowに従って確認する。
追加配信では既存Taskの継続境界を優先し、内容変更だけを新taskの根拠にしない。
