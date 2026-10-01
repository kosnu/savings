---
title: AIDD v4 Codex adapter
doc_type: policy
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
topics:
  - ai-driven-development
  - aidd-v4
  - git
  - sandbox
  - tool-execution
when_to_read:
  - AIDD v4 Codex adapterを判断または変更するとき
  - CodexでGit管理領域へ書き込むとき
  - Codexでツールを実行または実行中の処理を追跡するとき
---

# AIDD v4 Codex adapter

Codexは[共通workflow](workflow.md)を実行する。host固有のGoalや会話要約をCoreの入力契約へ持ち込まない。

## ツール実行状態の保持

実行時にhostが公開するtool仕様を確認し、出力本文だけでなく、実行中か終了済みか、
追跡用の識別子、終了コードやエラーを保持する。出力が空であることは、未起動・成功・失敗の根拠にならない。
出力だけを取り出して状態を捨てず、呼出元へ判断に必要な情報を返す。

| 状態     | 根拠と次の操作                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 実行中   | toolが実行中と返した処理を、返された識別子と対応する待機toolで追跡する。同じ処理を新規起動しない。                                                                     |
| 正常終了 | 対象処理の終了と成功を確認する。コマンドでは終了コード0を根拠とし、無出力でも成功として扱える。                                                                        |
| 失敗     | 非0の終了コードまたは明示的な失敗を確認し、原因を調べる。残存処理がないことを確認し、原因への対処後に必要な再実行を行う。                                              |
| 未確認   | 終了情報の欠落、追跡不能、通信エラーなどで対象処理の状態を確定できない。成功扱いも自動再起動もせず、元の処理の状態と副作用を確認する。確認不能ならその不足を報告する。 |

コマンドを`functions.exec`で呼ぶhostでは、外側の実行セルと内側のコマンドを区別する。
外側が完了しても、内側の処理が終了したとは限らない。次はこのAPIが公開されている場合の扱いであり、
名称・フィールド・待機時間の制約は実行時のtool仕様を優先する。

- `exec_command`が`session_id`を返した場合は、そのIDを`write_stdin`へ渡して終了結果まで追跡する。
  `output`が空でも`session_id`や`exit_code`を捨てない。
- `functions.exec`が`Script running with cell ID ...`を返した場合だけ、その`cell_id`で`functions.wait`を呼ぶ。
  セル終了時に受け取ったコマンド結果も確認し、内側が実行中なら引き続き`write_stdin`で追跡する。
  セルIDとコマンドのセッションIDは相互に代用しない。
- たとえば`const result = await tools.exec_command(...); text(result);`のように状態を含めて返す。
  大きな出力や非公開情報は必要範囲へ絞るが、追跡情報と終了状態は呼出元で利用できるように残す。
  非同期呼出しは`await`し、未完了のPromiseを残したまま実行セルを終了しない。

長時間処理にはtoolが許す十分な待機時間を選び、進捗が変わらない場合は待機を長くする。
無出力だけを理由に短間隔の確認や再起動を繰り返さない。hostの応答性・進捗報告の制約にも従い、
独立した作業があれば待機の間に進める。待機のタイムアウトや応答中断だけでは、対象処理の終了・停止は確定しない。
停止を要求した場合も終了結果を確認してから再実行を判断する。
並列の検証では各処理の状態を保持し、[AGENTS.md](../../AGENTS.md#verification)に従い開始済みのbatchを終えてから修正・再実行する。

この追跡には既存toolの情報を使い、新しいrunner、キャッシュ、永続状態管理や承認段階は設けない。
検証証拠を共有するときは、処理の種類、状態遷移、終了コード、起動・待機回数など必要な観測結果に絞り、
生ログ・個人情報・実際のセッション識別子を公開しない。

## 文脈取得の出力範囲

文書の選択は[Documentation Policy](../harness/policies/documentation-policy.md#参照ルール)に従う。
取得前に必要な文書・節を絞り、長い本文は出力上限に収まる範囲へ分ける。
必須の本文・依存を省く理由にはせず、取得結果の切り詰め表示や欠けた範囲を確認する。
切り詰められた場合、その呼び出しの終了コードが0でも全文を読めたとは扱わない。
読めた範囲を保持し、不足する文書・行範囲だけを追加取得する。同じ一括取得を繰り返さない。
判断に必要な範囲が未取得なら、その判断を未確認として追加取得後に確定する。

## Git管理領域への書き込み

Git操作の対象・権限・安全条件は[Git Workflow](../harness/policies/git-workflow.md)に従う。
実行前に`git rev-parse --git-common-dir`と`git rev-parse --git-dir`で管理領域を確認し、
hostが示す書き込み境界・保護対象と照合する。worktree本体や親directoryが書き込み可能でも、
`.git`やworktree固有の管理領域まで書き込み可能とは限らない。

操作が起動するhookの書き込みも同じ権限判断に含める。`git rev-parse --git-path hooks`で
`core.hooksPath`の設定やlinked worktreeの共通管理領域を考慮した実効hook directoryを取得する。
Git directoryに`hooks/`を足して推測せず、必要なら`git config --get core.hooksPath`で設定を補足確認する。実際に呼ばれるhookと
その設定から、退避・整形・復元で触る作業ファイル、index、cache等の書き込み先を必要な範囲で特定し、
hostの保護対象と照合する。Git管理領域が書き込み可能でも、hookが`.agents/`等の保護対象を
書き換えたり削除・復元したりする操作には権限が必要になる。

管理領域が保護されている場合、そこへ書き込む`git add`、`git commit`、`git fetch`、
branch作成・切り替えなどは、初回から`exec_command`の`sandbox_permissions: "require_escalated"`で要求する。
hookの書き込み先が保護されている場合も、そのhookを起動する必要なGit操作だけを初回から同じ方法で要求する。
通常実行で権限エラーを起こすことを昇格要求の前提にしない。`git push`もlocalのtracking ref等を
更新するため、remote操作だけとみなさず同じ判定を行う。

Codexのrulesによるコマンドの許可と、サンドボックス内のファイル書き込み制限は別に判断する。
既存rulesで許可されていても、通常実行で保護対象へ書き込めるとは解釈しない。
昇格要求は既存rulesとhostの承認判定に従い、必要なコマンドと対象に限定する。
昇格が禁止されているhostや要求が拒否された場合は、その制限を迂回せず停止理由を報告する。
この方針を理由にサンドボックス全体を無効化したり、包括的な許可ruleを追加したりしない。

`git diff`、`git log`、`git show`、`git rev-parse`などの読み取りは、Git管理領域の保護だけを理由に
一律に昇格しない。保護対象へ書き込まない操作は通常の実行経路を使い、別の制約がある場合は個別に判断する。

参考: OpenAI公式の[Sandbox](https://learn.chatgpt.com/docs/sandboxing)と
[Rules](https://learn.chatgpt.com/docs/agent-configuration/rules)（2026-09-28確認）。

## Goal機能との接続

Goalの作成可否と状態更新は、そのhostが公開するtoolの条件に従う。
作成に明示依頼が必要なhostでは、開発の実行依頼だけからGoalを作成しない。
既存Goalが同じTaskのものであれば親agentが所有・継続する。subagentにGoalの作成・完了を委譲しない。
GoalなしでもTaskの記録・検証・レビュー・Shipまで実施する。AuditはShip後の明示依頼を受けて実施する。

Goalには成果、Intentの参照、Task ID、完了条件を短く記す。Taskの判断やログ全文を複製しない。
予算を勝手に設定せず、ユーザーによるpauseやhostの制限を尊重する。
Shipを目的とするGoalの完了とサイクル完了を区別する。Audit未実施・改善承認待ちをサイクル完了としてGoalへ反映しない。

## 再開

明示したTask IDからCoreの`status`を取得し、開始Intentと実行権限、最新decision/checkpoint、
未達条件、検証・review・Ship・Audit・承認記録を必要な範囲で読む。前の会話の要約だけを証拠として扱わない。
旧版のStop/SessionStart hookやGoal本文からのTask推論を実行経路にしない。

### 必要項目の取得例

repository rootで、[Core操作](aidd-checker-operations.md)に従って現在sourceからbinaryを用意する。
以下はTask `issue-1852`の読み取り例。別TaskではIDを置き換え、eventのファイル名・kindは
実際の一覧で確認してから選ぶ。`task.json`の全文や`events/*.json`の本文を一括出力しない。

```sh
/tmp/aidd-v4 --root . status --task issue-1852

# 開始Intentの出典・本文・目的・制約・完了条件、実行権限、baseline。
# 全ファイルの開始時snapshotを持つinitialは出力しない。
jq '{id, created, intent, authority, baseline, initial_changes_acknowledged}' \
  .aidd/v4/issue-1852/task.json

# 本文ではなく、実在するファイル名・kind・revision・cycleと取得可能な項目を確認する。
jq -c '{file: input_filename, sequence, kind, cycle_id, revision,
  data_keys: (.data | keys)}' .aidd/v4/issue-1852/events/*.json
```

`status`の`cycle_id`、`revision`、`latest`、`evidence_current`を起点に、一覧の連番と照合する。
同じkindの最後のファイルだけを無条件に現在の証拠として採用しない。Intent改訂や
`return-intent`があれば該当eventも読み、開始Intentからの訂正、cycleの境界、承認への参照を確認する。
必須文書の選択・本文確認は通常どおり行い、取得例の出力を読了や意味評価の代わりにしない。

このTaskの一覧では`000012.json`が最新decision（revision 4）、`000013.json`がverify、
`000014.json`がreview。判断のscope・commands・rulesとreviewの条件別根拠は残し、
verifyはcommandごとの終了状態と実行前後の安定性を先に読む。

```sh
jq '{sequence, kind, cycle_id, revision, hash, fingerprint, data}' \
  .aidd/v4/issue-1852/events/000012.json \
  .aidd/v4/issue-1852/events/000014.json

# 通常取得ではcommandの生ログoutputだけを除き、終了情報は保持する。
jq '{sequence, kind, cycle_id, revision, hash, fingerprint,
  data: {stable: .data.stable,
    results: [.data.results[] | del(.output)]}}' \
  .aidd/v4/issue-1852/events/000013.json
```

終了コード0だけで現在の証拠とは扱わず、decision revision・cycle・fingerprintと
`evidence_current`を照合する。不一致・失敗・欠落は未達または未確認として扱い、
必要な詳細取得や再検証へつなげる。

このTaskの承認は`000009.json`の`approve`。提案IDと`audit_hash`が指す
`000008.json`のAudit、`000011.json`の`return-intent`も読み、承認対象・出典と次cycleへの引継ぎを確認する。
承認eventがなければ、一覧で存在しないことを確認し、元の実行委任から改善承認を推論しない。

```sh
jq '{sequence, kind, cycle_id, revision, hash, fingerprint, data}' \
  .aidd/v4/issue-1852/events/000008.json \
  .aidd/v4/issue-1852/events/000009.json \
  .aidd/v4/issue-1852/events/000011.json
```

改訂Intent・承認に本文がある旧eventは保持された本文を読み、`text_hash`のみのeventでは
構造化項目と出典を確認し、原文が判断に必要なら出典から追加取得する。
ShipはTask記録だけで確定しない。配信先はAuditの`delivery`や実在する旧Ship eventなどから特定し、
該当PR・commitをread-backする。これらは現在のAudit開始や改善実施の権限を付与しない。

追加取得も、必要なevent・項目・範囲へ絞る。たとえばverifyの結果配列で対象commandを確認した後、
その`output`を読む。出力が上限に近い場合は保存された文字列を分割し、取得済み範囲と残りを追跡する。
全文の再取得で切り詰めを繰り返さず、必要項目の欠落を未確認のまま合格へ変えない。

```sh
# このverifyのresults[0]はGo test。必要なログの先頭4000文字を取得する例。
jq '.data.results[0].output | {total_chars: length, offset: 0, text: .[0:4000]}' \
  .aidd/v4/issue-1852/events/000013.json

# 開始時snapshotが判断に必要な場合だけ、対象pathの機械情報を追加取得する。
jq '.initial["docs/ai-driven-development/workflow.md"]' \
  .aidd/v4/issue-1852/task.json
```
