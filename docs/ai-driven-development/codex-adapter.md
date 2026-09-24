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

既存成果へのShip依頼やreview修正では、task-startより先に既存Taskと対象PRを特定し、
[workflowの追加配信境界](workflow.md#追加配信とtaskの継続)を適用する。
Goalの終了や新しい会話はTask・baselineを作り直す理由にならない。
配信先を変えるagentの判断をユーザーのauthorizationへ書き足さず、既存Taskで続行できない場合は
失敗根拠と必要な境界変更を示す。checkerの成功だけを境界変更の許可根拠にしない。

同じTask内のルール保守では現在のGoalを継続する。単独Learn依頼のGoalはユーザーが求めた場合だけ作成する。
Goalのactive/blocked/pausedの扱いはhostのtool契約に従う。Coreの中断を偽の完了へ変換しない。
token budgetは明示された場合だけ設定する。Goal設定だけの依頼はTask実行を許可しない。
Goalを作成・確認した後も、作業の継続と完了は元のTask契約とユーザーの許可範囲に従う。

## 工程別の使用量記録

Developmentでは、同じGoalの`tokensUsed`と`timeUsedSeconds`の累積値を工程の境界で取得し、
隣り合う取得値の差分を工程ごとのトークン消費量・使用時間（秒）として記録する。
工程は準備、探索・判断、実装、検証・レビュー、Shipとし、最初の取得時点、各工程の終了時点、
Shipの配信状態とCI状態を確認した直後の取得時点を残す。工程を行き来した場合は区間を分けて記録し、
同じ工程の区間を合算する。Taskの再開や追加Shipでは既存の数値を上書きせず、新しい区間を加える。

各区間をCodex homeの`metrics/task-usage.jsonl`（通常は`~/.codex/metrics/task-usage.jsonl`）へ
JSON Linesで追記する。新規行は次のv2スキーマに従い、列挙値や欠測値を別表現へ置き換えない。
全キーを必須とし、記載のないキーは加えない。

| キー | 型・値 |
| --- | --- |
| `schema_version`, `kind` | 整数`2`、文字列`task_usage_interval` |
| `interval_id`, `task_id` | 空でない文字列。前者はログ全体で一意、後者はCore Task ID |
| `repository` | 空でない`owner/repository`形式の文字列 |
| `phase` | `preparation`、`explore_decide`、`build`、`verify_review`、`ship`、`unclassified`のいずれか。工程を特定できない取得不可区間だけ`unclassified`を使う |
| `started_at` | UTCのRFC 3339文字列。開始時刻を取得できない場合だけ`null` |
| `ended_at`, `recorded_at` | UTCのRFC 3339文字列。前者は区間の終了時刻、後者は行を追記した時刻 |
| `time_seconds`, `tokens` | 両方とも0以上の整数、または両方とも`null`。Goalの累積値の差分を記録する |
| `source` | 数値を取得した行は`codex_goal`、取得不可の行は`unavailable` |
| `unavailable_reason` | `source`が`codex_goal`なら`null`、`unavailable`なら空でない理由の文字列 |

`source`が`unavailable`の行では`time_seconds`と`tokens`をともに`null`にし、
`codex_goal`の行ではともに整数にする。既存の`schema_version: 1`の行は上書き・移行せず、
`kind`のない履歴として読み取る。週次集計ではv1の既存キーを対応する同名の項目として扱い、
v1にだけある`wall_elapsed_seconds`はGoal使用量へ加えない。形式不明・型不一致の行を推定で補完したり
黙って合算したりせず、取得不可として報告する。同じTaskの再開も既存行を上書きせず新しい区間として
追記し、週次集計で区間を重複計上しない。完了メッセージには工程ごとの数値と合計、取得不可の区間を返す。
Goal開始前の準備、Goal toolが利用できない区間、累積値が取得できない区間は推定やゼロ埋めをせず
取得不可として理由を記録する。この値はCodex Goalが返す使用量であり、実時間や課金額への換算はしない。
PR本文やPRテンプレートへ工程別の数値・記入案内を追加しない。

工程別記録は作業量の報告であり、Task / Decision / Checkpoint / Evidenceの正本やCoreの
検証・Ship gateを代替しない。GoalなしのhostでもCoreを実行し、使用量は取得不可と記録する。

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
