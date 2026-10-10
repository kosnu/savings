---
title: AIDD v4 Core
doc_type: policy
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
topics:
  - aidd-v4
when_to_read:
  - AIDD v4 Coreを実行または変更するとき
---

# AIDD Go Core

[Workflow](workflow.md)のうち、その場で判定できる状態をGoで検査する。
Task・操作イベント・全ファイルsnapshotを永続保存せず、過去の記録の生成や整合性を実行条件にしない。

## 検査の責務

- `rules`: path/surface一致と依存closureを解決し、規約索引の不備を拒否する。
- `check-changes --base`: merge-baseと現在の実差分から適用規約を解決する。検証・レビューの成功は示さない。
- `verify --base --input`: 有限の対象path・command・ruleを入力として、差分の範囲と必須command・ruleの不足を拒否し、commandを実行する。
- `ship-check`: stageとworktreeの内容・mode、stageの空白エラーを検査する。
- `ship --input`: local HEAD、worktree、remote branch、PRのhead/base/OPEN状態を照合する。

snapshotは検査中のメモリ内だけで使用する。検証結果はcommandのindex・終了コードと実行前後の安定性だけを返す。
コマンドの標準出力・標準エラーは実行中の診断表示に使用し、結果JSON・ファイル・履歴へ保存しない。
未起動・失敗・残留process・snapshot取得失敗・検証中の内容やmodeの変更を成功にしない。
検証commandの実行による残留processを終了し、検証を失敗にする。macOS/Linux以外では検証実行を拒否する。

## 記録

Intentと実行権限は既存のIssue・PR・ユーザー発言から確認する。
必要な引継ぎは採用判断、検証・レビューの要約、未確認事項、配信先への参照だけに絞り、既存のIssue・PR・会話を使う。
操作ごとの履歴、全ファイルsnapshot、コマンド生出力を別形式や別保存先に移さない。
専用のTaskファイル・イベント・ID・hash chain・revision台帳・工程計測を必須にしない。

検証・レビューを実際に行う責務はworkflow・担当agent・CIにある。
Coreは以前の実行や人間の承認を記録から証明せず、`ship-check`の成功だけで検証・レビュー済みとは扱わない。
変更後の内容に必要な検証を実施し、未実行・失敗・未確認を要約に明示する。

## 旧記録

`.aidd/v4/`等の既存記録は当時の履歴として保持する。現行の入力や必須成果物にしない。
旧`start`・`decision`・`review`・`audit`・`approve`・`dismiss`・`return-intent`・`status`・`check`・`improve-check`・`delivery-check`は廃止し、書き込み前に拒否する。
過去の内容を現在仕様に合わせて書き換えない。

具体的な入力と検証は[操作](aidd-checker-operations.md)に従う。
