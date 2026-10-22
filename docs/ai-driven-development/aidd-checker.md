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
操作イベント・全ファイルsnapshot・コマンド生出力は永続保存せず、工程ごとの最新結果だけを保持する。旧Task台帳を実行条件にしない。

Issue [#1903](https://github.com/kosnu/savings/issues/1903)のIntentに基づき、[ADR 0009](../adr/0009-rebuild-aidd-v4.md)のTask・判断revision・保存記録による承認範囲の機械検査を、実行時検査と工程別の最小結果へ置き換える。履歴上の変更関係はADRの2026-10-11 Clarification、現在の採否は[調査文書](research-v4.md)に示す。Intent・Ship・Audit・改善の権限境界は[Workflow](workflow.md)を維持する。

## 検査の責務

- `rules`: path/surface一致と依存closureを解決し、規約索引の不備を拒否する。
- `check-changes --base`: merge-baseと現在の実差分から適用規約を解決する。検証・レビューの成功は示さない。
- `verify --base --input`: 有限の対象path・command・ruleを入力として、差分の範囲と必須command・ruleの不足を拒否し、commandを実行する。
- `ship-check`: stageとworktreeの内容・mode、stageの空白エラーを検査する。
- `ship --input`: local HEAD、worktree、remote branch、PRのhead/base/OPEN状態を照合する。Ship記録は書かない。
- `record-begin`: 同じサイクル・同じ工程の結果をrunningへ更新する。cycleなしのdesignは次サイクルを開始する。
- `record-finish`: 短い結果だけを保存する。開始後の対象変更をpassとして保存しない。
- `record-read`: 現在の対象と照合し、前サイクル・対象変更・runningを現在の成功として返さない。

`verify`の対象pathは実際の変更対象を指定する。記録契約の配置に一致する`.aidd/v4/<作業名>/events/<6桁の連番>.json`の追加・更新は工程結果の補助差分として許可し、対象pathへの追加を要求しない。作業名は下記の共通受理条件に従う。工程結果の削除と、この配置に一致しないファイルは通常の対象path検査を受ける。`.aidd/`全体を除外しない。

snapshotは検査中のメモリ内だけで使用する。検証結果はcommandのindex・終了コードと実行前後の安定性だけを返す。
検証実行中の安定性とShipの内容・mode照合には工程結果も含める。補助差分の許可で、検証commandによるファイル変更やstageとの不一致を許可しない。
コマンドの標準出力・標準エラーは実行中の診断表示に使用し、結果JSON・ファイル・履歴へ保存しない。
未起動・失敗・残留process・snapshot取得失敗・検証中の内容やmodeの変更を成功にしない。
検証commandの実行による残留processを終了し、検証を失敗にする。macOS/Linux以外では検証実行を拒否する。

## 記録

Intentと実行権限は既存Issue・PR・ユーザー発言を正本として確認し、本文を複製しない。
`.aidd/v4/<作業名>/events/000001.json`の配置・連番を使う。これは操作eventではなく工程結果であり、formatは`aidd-phase-result-v1`とする。
記録対象はdesign・verify・review・手動開始されたauditだけ。実際に行わない工程の空記録、Task本文、承認・復帰event、Ship記録は作らない。

記録前に[WorkflowのTask判断](workflow.md#taskの開始と継続)を行い、そのTaskに対応する作業名を`--task`へ指定する。
Coreは作業名・cycle・kindに従って保存先を選ぶが、Issue・PR・`source`からTaskの同一性や継続権限を判定しない。
新しいTaskは別の作業名で開始し、既存Taskと同じ名前を使って結果を置き換えない。Taskの判定がunknownなら記録操作を行わない。
Task内のcycle・工程の追加と更新は以下の契約に従う。[操作例](aidd-checker-operations.md#taskと記録先の選択)で具体的な保存先を確認する。

Coreと任意計測CLIが扱う作業名は、先頭がASCII英数字、以降がASCII英数字・`_`・`-`の1〜128文字とする（`^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$`）。空値、先頭の`_`・`-`、空白、`.`やpath区切り、129文字以上は受け付けない。この節を共通の受理条件の正本とし、両CLIで同じ境界値の受理・拒否を確認する。

- cycleはそのサイクルを開始したdesign記録のファイル名を参照する。commit/rebaseや新しいサイクル連番に依存しない。
- 同じcycle・kindは同じファイルを更新する。再試行のたびにファイルや本文の履歴を増やさない。
- cycleなしのdesignで次サイクルを開始し、前サイクルを凍結する。旧cycleへのbegin・finishを拒否する。過去の結果は当時の履歴として読めるが、現在の成功にしない。
- 内容はIntent等の参照、有限の確認対象path、状態、確認名、短い結果、残る問題と対象内容・modeの識別値だけ。1件8 KiB以下、summaryは単一行1200 bytes以下、checksは32件以下、remainingは8件以下とする。上限を埋めず必要な内容だけを残す。
- 開始前に`record-begin`を呼び、前の成功を解除する。完了時だけ`record-finish`でpass/fail/unknownを更新する。中断・保存失敗は現在の成功にしない。
- 鮮度はrecordを除く現在のrepository内容・modeの単一digestで照合する。対象外の変更でも保守的に失効する。全ファイルsnapshot・ファイル別hash一覧は保存しない。記録の更新・commit・rebaseだけで内容/modeが変わらない場合は失効させない。
- `record-read`で鮮度を確認せず、JSONのpassをそのまま再利用しない。結果はagentの短い評価であり、終了宣言だけを検証・意味評価・人間の承認の証明にしない。
- コマンド生出力・argv・全文コピーを入力しない。未知のJSON field、過大な本文、複数行の結果を拒否する。診断は実行中の表示だけで使用する。

工程結果は通常の成果commitへまとめる。操作・再試行ごとの記録専用commitと、配信後の記録commitは要求しない。
Audit結果は分析資料であり、次サイクルのIntent・実行指示・承認ではない。元のIntentと承認された提案・対象・範囲を再確認する。
読み取り専用の説明・レビューで工程記録の書き込み権限を作らない。

検証・レビューを実際に行う責務はworkflow・担当agent・CIにある。
Coreは人間の承認を記録から証明せず、`ship-check`や記録のpassだけで検証・レビュー済みとは扱わない。
変更後の内容に必要な検証を実施し、未実行・失敗・未確認を明示する。

## 旧記録

`.aidd/v4/`等の既存記録は当時の履歴として保持する。現行の入力や必須成果物にしない。
旧`start`・`decision`・`review`・`audit`・`approve`・`dismiss`・`return-intent`・`status`・`check`・`improve-check`・`delivery-check`は廃止し、書き込み前に拒否する。
過去の内容を現在仕様に合わせて書き換えない。

具体的な入力と検証は[操作](aidd-checker-operations.md)に従う。

## CIの起動と権限

Frontend・AIDD CIとVite+同期のPRイベントは、PRコードを実行しない`pull_request_target`の受付で扱う。
通常PR・fork PRのCIは信頼されたmainのworkflowを`workflow_dispatch`で起動し、PR headとmerge結果を検証する。
PRコードを実行するjobのtokenはread権限に限定し、mainスコープのcacheへ保存しない。
結果投稿のwrite権限は、checkoutもPRコード実行もしない別jobだけに与える。
Vite+の依存同期は署名付きRenovate候補を確認して別runへdispatchする。同期後もCIをdispatchし、
結果を対象PR head SHAのcommit statusへ返す。`pull_request`の重複購読による承認待ちrunを生成しない。
