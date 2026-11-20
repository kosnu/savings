---
title: Harness Checker
doc_type: policy
status: accepted
area: repository
applies_to:
  - tools/harness
  - docs/ai-driven-development
topics:
  - aidd-v4
when_to_read:
  - Harness Checkerを実行または変更するとき
---

# Harness Checker

[Workflow](workflow.md)のうち、その場で判定できる状態をGoで検査する。
通常の検証は工程記録を必要としない。引き継ぎ用の工程記録を使う場合だけ、同じ工程の最新結果を保持する。

Issue [#1903](https://github.com/kosnu/savings/issues/1903)のIntentに基づき、[ADR 0009](../adr/0009-rebuild-aidd-v4.md)のTask・判断revision・保存記録による承認範囲の機械検査を、実行時検査と工程別の最小結果へ置き換える。履歴上の変更関係はADRの2026-10-11 Clarification、その後に工程記録を引き継ぎ時の選択とした判断は[ADR 0010](../adr/0010-evidence-first-development.md)に示す。Intent・Ship・Audit・改善の権限境界は[Workflow](workflow.md)を維持する。

## 検査の責務

- `rules`: path/surface一致と依存closureを解決し、規約索引の不備を拒否する。
- `check-changes --base`: merge-baseと現在の実差分から適用規約を解決し、`docs/` 直下のMarkdownが[配置基準](../harness/policies/documentation-policy.md#配置先)に合うか検査する。
- `plan --base <commit/ref> -- <path>...`: 明示された委任範囲内の実差分、固定した比較元SHA、適用規約のID・本文パス、必須コマンドを返す。コマンドは実行しない。
- `verify --base <commit/ref> -- <path>...`: 同じ計画を現在の差分から組み直して実行する。空差分、範囲外（工程記録を含む）、文書の誤配置はコマンド実行前に拒否する。
- `verify --base --input`: 有限の対象path・command・ruleを入力として、差分の範囲と必須command・ruleの不足を拒否し、commandを実行する。
- `ship-check`: stageとworktreeの内容・mode、stageの空白エラーを検査する。
- `ship --input`: local HEAD、worktree、remote branch、PRのhead/base/OPEN状態を照合する。Ship記録は書かない。
- `record-begin`: 同じサイクル・同じ工程の結果をrunningへ更新する。cycleなしのdesignは次サイクルを開始する。
- `record-finish`: 短い結果だけを保存する。開始後の対象変更をpassとして保存しない。
- `record-read`: 現在の対象と照合し、前サイクル・対象変更・runningを現在の成功として返さない。

既存の計画入力（`verify --input`）の対象pathは実際の変更対象を指定する。記録契約の配置に一致する`.aidd/v4/<作業名>/events/<6桁の連番>.json`の追加・更新は工程結果の補助差分として許可し、対象pathへの追加を要求しない。作業名は下記の共通受理条件に従う。工程結果の削除と、この配置に一致しないファイルは通常の対象path検査を受ける。`.aidd/`全体を除外しない。

snapshotは検査中のメモリ内だけで使用する。検証結果はcommandのindex・終了コードと実行前後の安定性を返す。path指定では実際に使用した計画も返す。
検証実行中の安定性とShipの内容・mode照合には工程結果も含める。補助差分の許可で、検証commandによるファイル変更やstageとの不一致を許可しない。
コマンドの標準出力・標準エラーは実行中の診断表示に使用し、結果JSON・ファイル・履歴へ保存しない。
未起動・失敗・残留process・snapshot取得失敗・検証中の内容やmodeの変更を成功にしない。
検証commandの実行による残留processを終了し、検証を失敗にする。macOS/Linux以外では検証実行を拒否する。

配信時のリモートSHA・PR情報の取得には各30秒の期限を設ける。macOS/Linuxで取得コマンドを専用のプロセスグループで実行し、期限超過時はグループを終了して照合未完了を返す。再確認は読み取り専用の照合を実行する。

## 記録

[Workflow](workflow.md#intentと実行権限)の引き継ぎ条件を満たす場合にこの契約を使う。記録のないTaskでAuditを依頼された場合もPRまたは会話に結果を示せる。過去のdesign・verify・reviewを事後作成しない。

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

Frontend・AIDD CIは通常PR・fork PRとも`pull_request`で直接起動し、PR headとmerge結果を検証する。
workflow・テスト・Checkerの変更もPRの検証とレビュー対象に含め、mainのworkflow定義への固定は行わない。
PRコードを実行する検証jobのtokenはread権限に限定し、cacheへの保存は行わない。
Vite+依存同期の受付も`pull_request`を使い、同一repositoryのRenovate候補だけを別runへdispatchする。
同期処理は署名・変更範囲・現在headを確認してから依存を更新する。同期commitは`GITHUB_TOKEN`で作成するため、
通常のPRイベントに頼らず、更新後のPRブランチへFrontend・AIDD CIをdispatchする。
このdispatchの結果だけを、checkoutもPRコード実行もしない別jobから対象PR head SHAのcommit statusへ返す。
Checkerのconcurrency groupはPR番号と起動イベントで分離し、旧受付のdispatchと新しいPR起動を競合させない。
同じPR・同じイベントの再実行は同じgroupで古い実行を取り消す。
fork PRの検証に書き込みtokenやSecretsは渡さない。PR作成者の自動アサインはforkへの書き込みが必要なため、
PRコードを取得・実行しない`pull_request_target`を維持する。
Previewの配信要求は同一repository限定の`pull_request`を使う。
競合PRでも終了時の削除要求を届けるため、終了通知だけは`pull_request_target`の`closed`を使う。
この経路ではforkを拒否し、mainの補助コードだけを実行する。PRコードの取得・実行や配信は行わない。
