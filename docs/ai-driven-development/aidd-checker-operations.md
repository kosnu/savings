---
title: AIDD Checker Operations
doc_type: guide
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
  - vite.config.ts
  - .vite-hooks
topics:
  - schema-v5
  - verification
  - commit-hooks
when_to_read:
  - Task、checkpoint、検証、ShipのCLIを実行するとき
  - リポジトリ共通の検証ゲートやvp stagedの設定を変更するとき
---

# AIDD vNext operations

## 開始時のbinary

専用clean worktreeで次を実行し、返された絶対pathをTask期間中保持する。
準備commandが入力hashを計算し、対応するbinaryがないときだけchecker本体をbuildする。
同じ入力の次Taskでは保存済みmanifestとbinary hashを照合して再利用する。
agentによる毎回の版選択や承認は不要。以下の`/tmp/aidd-task-checker`表記は取得したpathで読み替える。

```sh
checker_binary=$(env GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=local GO111MODULE= GOOS= GOARCH= GOEXPERIMENT= CGO_ENABLED=0 GOAMD64= GOARM= GOARM64= GO386= GOMIPS= GOMIPS64= GOPPC64= GORISCV64= GOWASM= go run -C tools/aidd/checker ./cmd/aidd-prepare)
"$checker_binary" version
```

起動するgo runにもhost既定のOS・architecture・実験設定を適用し、CGOを無効にする。
architecture別設定も既定へ戻すため、cross compile用の呼出環境を準備commandへ引き継がない。

小さなGo準備commandの起動はGo標準のbuild cacheを使用する。checker本体の再利用判定と保存は
準備commandが担い、通常のTaskごとにchecker本体をbuildしない。新しい外部依存は不要。
保存先はOSのuser cache directory配下の`aidd-checker/binaries/<input-hash>/`。
ソース・連動契約の具体的集合と選定理由は[architecture](aidd-checker.md#task間のbinary再利用)を参照する。
Go toolchain version、host OS/architectureとarchitecture設定を入力に含め、CGOを無効にする。
GOFLAGS・GOWORK・GOENV・GOEXPERIMENT等の呼出環境からのchecker build差し替えは使わない。
Go cache/module cacheに書込できない環境ではrepository外のGOCACHE/GOMODCACHEを明示する。

同時準備は入力hashごとのmkdir lockで直列化し、一時directoryで完成させてatomic renameで公開する。
既存entryのmanifest欠落・不整合、binary欠落・hash不一致・symlinkは停止条件で、再buildへfallbackしない。
強制終了でlockが残ると30秒で停止しpathを報告する。実行中の準備がないことを確認してから残存lockを除去する。
破損entryは原因を調査し、利用中Taskがないことを確認して退避した後に再準備する。任意binaryへ切り替えない。

Learnも開始前に取得したbinaryと旧policy/profileを保持する。変更後candidateの確認は別の変数・pathで
prepareし、その成功だけでLearnを確定しない。Taskの途中で開始時変数へ再代入しない。
CIは現在のtarget baseのcheckerソースを新規directoryへ展開し、直接buildする。
base検証はcandidateのテスト・buildを実行しない独立jobで行い、base checkoutのgo.modからGoを準備する。
候補がGITHUB_PATH/GITHUB_ENVへ書き込んでもbase jobの実行環境へ引き継がない。
baseにprotocolがない初回bootstrapのみcandidate jobで実行する。
base側ではbinary cacheを利用せず、GOCACHE/GOMODCACHEも新規directory配下に固定する。
GOENV/GOWORK/GOFLAGS/GOTOOLCHAINを固定し、候補側のcacheやbuild設定を取得元にしない。
candidate検証用buildは別binaryへ行い、base検証の代替にしない。
CoreはGoalやHookを呼び出さない。

## Task contract

sourceはrepository外のregular non-symlink JSON。出典本文を取得した後にSHA-256を計算する。
`action: execute`は実行依頼からのみ設定する。質問・説明・調査をexecuteへ読み替えない。

```json
{
  "schema_version": 5,
  "kind": "development",
  "action": "execute",
  "id": "issue-123-cycle-1",
  "intent": {
    "kind": "issue",
    "reference": "https://github.com/kosnu/savings/issues/123",
    "body": "取得したIssue本文",
    "body_sha256": "本文bytesのSHA-256"
  },
  "objective": "今回の実行で達成する結果",
  "constraints": ["守るべき境界"],
  "done": ["観測可能な完了条件", "検証・review・commit・push・PR作成または更新と配信状態の確認"],
  "verification": ["必要な検証と確認対象"]
}
```

Taskに配信区分は設けない。Developmentは通常commit・push・PR作成または更新まで実行する。
ユーザーの明示的な制限はconstraintsとDoneへ記録する。後続の明示許可は同じTaskの継続で扱う。
新規task-startは旧sourceのdelivery fieldも保存しない。旧Task内のlocal/prはcanonical bytesと
hashを維持して読み取る互換fieldであり、finish・Ship・CIの分岐には使わない。
Coreの成功はmerge/deploy権限を与えない。
Learnは`kind: learn`、`intent.kind: feedback`とし、Issue URLは不要。
明示的な変更依頼の`authorization`と、`authorized_scopes: [{"path":"対象","kind":"file"}]`
を追加する。pathは有限のfile/tree。product pathは許可scopeへ含めても変更できない。

```sh
/tmp/aidd-task-checker task-start --repo-root . --source /tmp/task-spec.json
```

出力されたtask SHA-256を保持する。正本は`.aidd/tasks/<id>/task.json`。
Taskは開始時HEAD、全non-ignored baseline、policy/rule-map/profileのbytes、checker hashを固定する。
既存Taskを上書きせず、baselineを取り直さない。Taskの開始前に実装を持ち込まない。
既存成果の追加配信では、このcommandを再実行する前に
[workflowの継続境界](workflow.md#追加配信とtaskの継続)を確認する。
別IDとcleanなworktreeでtask-startが成功しても、既存Taskの置換が許可されたことにはならない。

## Decision / checkpoint

Decision sourceはschema_version 5、kind decision、task_sha256、reason、requirements、
target_state、additional_rulesを持つ。

requirementsは`id`、`text`、`origin`、`evidence`を持つ。originはintent/guardrail/derived。
intentのevidenceは本文の実在span、guardrailはrule ID、derivedは導出理由を記録する。
TaskのDoneが要求と検証に展開されていることはreviewで確認する。

target_stateは既存のtyped構造を継承する。

- product_behaviors: PB-ID、type（user_operation/state_transition）、description、requirement_id。
  Learnではguardrailの観測可能な効果を表し、product実装の許可を意味しない。
- verification_cases: VC-ID、type、requirement_id、product_behavior_ids。
  automatedはverification_profile_idとselector、manualはprocedureだけを持つ。
- ownership_scopes: 正規化されたpathとfile/tree。重複、開始時repository policyで禁止されたtree scope、checker出力scopeを拒否。
- representations: REP-ID、kind、path、locator、requirement_id、product_behavior_ids、verification_case_ids。
  locatorはfile/export/test_caseのmetadataであり、source構文の推論には使わない。

IDとscopeは既存の数値順・path順を使う。固定headingやphase Goalの本文は不要。
additional_rulesは自動routingで得られない探索上の必要rule ID。必須ruleを除外する用途には使わない。

```sh
/tmp/aidd-task-checker checkpoint --repo-root . --task issue-123-cycle-1 \
  --task-sha256 <task-hash> --source /tmp/decision.json
```

改訂時は同じcommandへ`--checkpoint-sha256 <最新checkpoint-hash>`を追加する。
checkpointは`checkpoints/000001.json`から追記され、Taskと全履歴を再検証する。
reasonへ変更・削除した判断と根拠を記録する。旧checkpointやbaselineを上書きしない。

## main取り込みの記録

統合を扱える開始時checkerのTaskでは、mainを取り込んだ後、Decision sourceへ次のfieldを追加して
通常の`checkpoint`を実行する。`base_head`は取得したtarget baseの完全SHA、`head`はそれを含む統合後commitの完全SHA。

```json
"integration": {
  "base_head": "取得したtarget baseの40桁SHA",
  "head": "統合後commitの40桁SHA"
}
```

Task開始点がbaseのancestor、baseが統合headのancestor、統合headが現在HEADのancestorであることを要求する。
再統合時は前回base/headを含む次のbase/headを指定し、最新checkpointを親として改訂する。
統合後も同じ記録を保持して再開できる。recordの除去や後退は許可しない。
旧証拠は流用せず、通常の`verify`で全caseを再実行し、`check`・`finish`・`ship-check`を通す。
Git checkoutで自Taskの出力が0644になった場合は、ローカル操作前にregular JSONの0600要件を復元する。

CIでは実際のPR merge-baseと現在のtarget baseをそれぞれ渡す。

```sh
/tmp/base-aidd-checker ci-check --repo-root . --base <PR-merge-base> --target-base <current-target-base>
```

統合記録があるTaskでは両方が記録のbaseと一致する必要がある。target baseが進んだ場合は失敗し、
再取り込み・checkpoint改訂・全再検証を要求する。別Taskを含むmain由来変更はbaseのGit treeで照合し、
独自の変更は元Taskの許可範囲で検査する。未許可の競合解消を権限拡張として受け入れない。

### 旧Taskのchecker移行

開始時checkerが統合記録を扱えないLearnは、明示許可に基づくchecker移行を新checkpointへ追記する。
Taskの開始記録、元baseline、旧policy/profile、旧checkpointと旧証跡を保持し、新Taskで置換しない。
移行先binaryを独立にbuildしてSHA-256を取得し、外部Decision sourceへ次を追加する。

- `checker_migration.from_checker_sha256`: 現在の実行checkerのhash（初回はTaskの開始時hash）。
- `to_checker_sha256`: 以後の実行に固定する移行先binaryのhash。
- `from_checkpoint_sha256` / `from_evidence_sha256`: 最新checkpointとその既存証跡のhash。
- `authorization`: 移行と必要な追加修正について実際に得た明示許可。
- `authorized_scopes`: 追加修正を許可された有限のguardrail file/treeをpath順に列挙。追加がなければ空配列。

移行先binaryで通常の`checkpoint`を実行する。初回の移行記録は現在checkpointを参照する場合だけ受け付け、
実行binaryのhashを移行先と照合する。以後のcheckpointは同じ移行記録を保持する。再移行はその時点の
checkpoint・証跡・実行checkerから追記し、記録の除去は拒否する。Taskの固定scopeを上書きせず、追加の許可は
移行記録の履歴へ残す。product変更は追加scopeに指定しても拒否する。

必要なら同じDecisionに`integration`を指定し、全差分のownership・要求・verificationを具体化する。
旧証跡は移行元の履歴参照であり、現在状態の成功根拠にしない。移行先binaryで全caseを再verifyし、
そのbinaryのhashと新checkpointへ結合した証跡でcheck・finish・ship-checkを行う。
独立Learnで検証したguardrail変更を元PRへ反映する場合も、元Taskの移行checkpointで全PR差分を再検証する。
独立Learnの記録はその作業branchに保持し、元Taskを別Taskで覆い直さない。

この移行を含むTaskは通常のci-checkでは`MIGRATION_REQUIRED`で拒否する。
PRの契約移行申請を記載し、candidate jobだけが`ci-check --contract-migration`を実行する。
このflagはbase側の限定差分検査・現在のbase/head/本文との一致・GitHub Environmentの人による承認の代替ではない。
移行先の候補checker成功だけで配信を受け入れず、必ず下記の非互換契約移行経路を通す。

## Verification

formatter等の意図的な変更を先に完了し、最終状態を固定してから実行する。
WebではAGENTS.mdの対象検証を満たす。Storybook browser-test対象を変更した場合は
該当profileをDecisionへ含める。開始時repository policyが指定するStoryの文字列を変更前または現在のsourceで観測した場合も、宣言されたsuiteを要求する。API専用verificationが未定義であることを成功証拠へ置き換えない。

```sh
/tmp/aidd-task-checker verify --repo-root . --task <id> \
  --task-sha256 <task-hash> --checkpoint-sha256 <checkpoint-hash>
```

manual caseには`--manual-observation 'VC-2=具体的に観測した結果'`を追加する。
観測なしの成功を記載しない。失敗は範囲内で修正後に新しいbatchで再実行する。
runnerはprofile固定argv、process group、runtime identity、repository mutationを検査する。
mutationの対象はGit管理対象と未ignoreの新規file。ignoreされた未追跡cacheの生成・更新・削除は許可する。
`.tsbuildinfo`等の正常な生成物を理由に検証を中断せず、個別の除外指定も追加しない。
Git管理済みfileはignore指定があっても保護し、検証中のHEAD/index変更も引き続き拒否する。
成功出力のevidence hashを保持する。正本は`evidence/<checkpoint-hash>.json`。

```sh
/tmp/aidd-task-checker check --repo-root . --task <id> \
  --task-sha256 <task-hash> --checkpoint-sha256 <checkpoint-hash> \
  --evidence-sha256 <evidence-hash>
```

改訂または対象変更で旧証拠は失効する。全caseを再実行する。
`check`は整合検査であり、意味的reviewやLearn確定の代わりではない。

## Learn確定

変更開始時のbinaryでverifyを完了する。担当agent自身が最新差分と検証証拠をreviewし、
Taskに固定した許可範囲で確定する。独立reviewや別agentの呼び出しは、ユーザーが明示的に依頼した場合だけ行う。

local完了前にも`finish --repo-root . --task <id> --task-sha256 <task-hash> --checkpoint-sha256 <checkpoint-hash> --evidence-sha256 <evidence-hash>`を実行する。
finishは最新の検証証拠を要求する。commit前のstaged検査はship-checkで行う。Learnのfinish/Ship/CIにreview記録は不要。

`learn-review`は任意のreview記録用として維持する。使用時の必須fieldはschema_version=5、
kind=learn_review、task_sha256、checkpoint_sha256、evidence_sha256、reviewer、authorization、observations。
記録はテスト出力から生成せず、実際の確認者・許可・観察を記載する。

```sh
/tmp/aidd-task-checker learn-review --repo-root . --task <id> \
  --task-sha256 <task-hash> --checkpoint-sha256 <checkpoint-hash> \
  --evidence-sha256 <evidence-hash> --source /tmp/review.json \
  --source-sha256 <review-file-hash>
```

product実装が必要なら既存Issueへhandoffして終了する。

## Ship / CI

依頼された範囲だけをstageし、commit前に検査する。

```sh
/tmp/aidd-task-checker ship-check --repo-root . --task <id> \
  --task-sha256 <task-hash> --checkpoint-sha256 <checkpoint-hash> \
  --evidence-sha256 <evidence-hash>
```

内容やmodeの不一致、未stage出力、未検証変更があればcommitしない。Learnのreview記録は任意だが、
存在する場合は必須項目と参照先の検証証拠との対応を検査する。過去checkpointの記録は履歴として
保持でき、最新reviewの追加は要求しない。同じcheckpointの再検証で参照先の証拠が置き換わった
記録は削除できる。再記録する場合は古い任意記録を削除し、実際に再reviewした内容だけを記録する。
公開操作とread-backは実行adapterが行う。Core gate成功だけではpush/PR完了ではない。

追加配信時は既存Taskのtask/checkpoint identityと開始時binaryを引き継ぎ、同じbaselineから
verify、stage、ship-check、commit、配信read-backを行う。基準点不一致などで失敗した場合は
新Taskで再検査せず、元TaskとPRの境界を確認する。追加許可のためにtask.jsonを書き換える必要はない。

既存Taskの記録互換性と実行binaryの互換性は別である。区分撤去前に開始したTaskは旧binaryを
保持するため、そのbinaryのship-checkは旧delivery条件で拒否し得る。checker identityの移行は上記の明示的な移行checkpointで扱う。記録なしのcandidate binaryへの
差し替えやTaskの再作成では迂回せず、旧記録と検査結果を保持する。更新済みtrusted baseのCIは旧Taskを読み取り、配信区分以外の同じ検査を行える。
逆に旧baseのCIはdeliveryを持たない新Taskを受け付けないため、base checkerの更新前は新形式を配信できない。

配信の受入確認では、文書整合と実際の検出範囲を分ける。同Taskの継続は
`TestSameTaskContinuesAfterCommitAndReviewRevision`、元baseline以前の差分を隠せないことは
`TestDeliveryCannotHideEarlierCommits`、新規・旧local/pr Taskのfinish・Ship・CIと記録不変性は
`TestTaskDeliveryDoesNotGateCompletionOrShip`、新規Taskのfield省略は
`TestNewTaskDropsLegacyDeliveryInput`で確認できる。
現在のci-checkは対象PR内のTaskとbaseを照合し、別PRの元Taskとの対応は入力として受け取らない。
別PRへの成果物の移し替えを防止できたと判断するには、その対応を取得・照合する責務と根拠が必要であり、
これらの既存testや文書検査の成功だけでは証明できない。許可の意味判断と、対応情報の不足を区別する。

Renovateだけが生成したPRはAIDDのTaskを生成しないため、CIの配信証跡検査の対象外とする。
GitHub eventのPR作成者loginが`renovate[bot]`と一致し、現在のtarget baseに含まれない全commitが
GitHub APIで対象SHAと一致するRenovate author、および有効なGitHub署名（signerは`web-flow`）を
持つと確認できる場合だけ適用する。Gitのauthor/committerメールや署名の有効性だけを出所の証明にしない。
[GitHubのbot署名契約](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification#signature-verification-for-bots)
は、認証されたbotの要求でauthor・committer・署名を任意指定していないことを前提とする。
実行者やbranch名で判定せず、人の追加commit、未署名、署名不正、API失敗・欠落などで確認できなければ
通常の配信検査へ戻す。commit一覧はGitから取得し、全件のSHAに対して照合する。
CIのAPI照会にはread-onlyのGitHub tokenと`gh`を使う。workflow回帰testは`bash`・`git`・`jq`を使い、API通信はfixtureへ置き換える。
checkerのGo検証と既存artifactのcheck-allは引き続き実行する。
それ以外のPRでは、commit後のCIは現在のPR target base側のcheckerをbuildし、clean candidateで次を実行する。

```sh
/tmp/base-aidd-checker ci-check --repo-root . --base <PR-merge-base>
```

変更されたTaskは1件に特定する。初期版は1 PR=1 taskとし、Taskの変更判定基準とPR merge-baseの一致（統合時は現在のtarget baseとも一致）、
開始時policy/profileとGit baseline、最終content/Git mode、rule/ownership/verificationを検査する。
初回vNext導入PRだけは現在のtarget baseとmerge-baseの両方にv5がないため、candidateの回帰検証と独立reviewでbootstrapする。
古い分岐PRでも現在のtarget baseにv5があれば通常経路を使う。merge-baseにTask基準のv5がない場合は
bootstrapへfallbackせず失敗し、最新baseへ追従して適切なTask/evidenceを準備する。
`bootstrap-check --repo-root . --base <merge-base> --target-base <current-base>`はvnext-bootstrap.jsonの独立reviewと
対象差分のcontent/Git mode/pathを照合する。記録欠落・差分変更・現在のtarget baseまたはmerge-baseに既存v5がある場合は拒否する。
manifestから除外するのはbootstrapとverificationの記録JSONだけで、実装・設定・正本文書は含める。
reviewerの真正性はLearnと同じ運用境界で扱う。
この初回を既存v5基準による検証済みとは報告しない。v5導入後はtask欠落を成功扱いにしない。

## 非互換なchecker契約の移行

通常のPRはbase checkerの`ci-check`を通す。base checkerの契約と非互換な変更だけは、
以下の明示的な移行経路を使える。単なる検証失敗やcandidate成功だけでは切り替えない。

1. 元のTask・baseline・開始時checkerを保持し、非互換になる契約と理由を特定する。
2. PR本文に下記の専用JSON blockを1件記載する。現在のbase/head SHA、元のTask IDと移行理由を記録する。
   Taskの固定ownershipを拡張するための新規fileやTask再作成は不要。本文の編集は新しいCI runを起動する。
3. candidateのGo全テスト・check-all・candidate版ci-checkを通す。
4. baseのci-checkが失敗した場合だけ、baseからbuildした`aidd-migration`が差分と承認設定を検査する。
5. GitHub Actionsの`migration` jobが承認待ちになる。指定reviewerがbase検証の失敗理由、
   移行理由、candidateの結果、Environmentのリンク先の全差分を確認して承認する。
6. 承認後もbase側の検査を再実行し、実runの承認者・Environment・現在のPR base/headを確認する。
   required check名`verify`は通常検証成功またはこの移行成功だけを受け入れる。

candidateのGo全テスト・check-allとcandidate版ci-checkは現在のPR headで実行する。
candidate版ci-checkにもPR merge-baseと現在のtarget base、および申請のTask IDを渡す。
main取り込みがある場合は上記の統合記録と最終状態の最新証拠を要求する。
統合結果はintegration jobでも検証する。Task記録だけを過去のtreeへ重ねて検査しない。
base側の差分・scope検査と承認は、PRのmerge-baseからheadまでの全差分へ適用する。

CI契約の移行とTaskの実行checkerの移行は区別する。`--contract-migration`は候補検証の経路を
選択するだけで、Taskのchecker identityや証跡の要件を免除しない。

| Taskの検証方法                                            | 必要な記録と証跡                                                                 | 候補検証の判定 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------- |
| 開始時checkerで検証を継続し、CI契約だけを移行する         | `checker_migration`は不要。開始時checker・最新checkpoint・最終状態に結合した証跡 | 受入可能       |
| Taskの実行checkerも移行する                               | `checker_migration`と、移行先checker・最新checkpoint・最終状態に結合した新証跡   | 受入可能       |
| 移行記録なしで別checkerの証跡を使う                       | 開始時checkerと証跡のidentityが不一致                                            | 拒否           |
| 移行記録ありで移行前のcheckerまたはcheckpointの証跡を使う | 移行先checkerまたは最新checkpointと証跡のidentityが不一致                        | 拒否           |

候補checkerは`ValidateEvidence`でこの照合と最終inventoryの一致を強制する。
base側の差分検査はTaskの意味検査を代行せず、人の承認も欠落した証跡の代わりにはしない。
契約移行だけのTaskへ実行checker移行を強制しない。開始時checkerが現在状態を検証できない場合は、
旧証跡を流用せず「旧Taskのchecker移行」に従って記録を追記し全再検証する。

PR本文の申請形式は次のとおり。`reason`は、廃止・変更する契約、base checkerが受け入れない理由、
新しい契約で維持・置換する保証を具体的に記す。本文の申請は承認そのものではない。

````markdown
```aidd-contract-migration
{
  "schema_version": 1,
  "kind": "aidd_contract_migration",
  "target_base_sha": "現在のPR baseの完全40桁commit SHA",
  "head_sha": "現在のPR headの完全40桁commit SHA",
  "task_id": "元のtask-id",
  "reason": "非互換となる契約と新しい保証の説明"
}
```
````

移行差分は`tools/aidd/`、`docs/ai-driven-development/`、`docs/harness/`、`docs/adr/`、
AIDDの4つのskill（aidd-cycle、learn、harness-task、goal-setting）、`aidd_checker_ci.yaml`と
指定した1件のTask記録に限定する。checkerまたはcontract変更を必須とし、
product、混在package設定、他のCI、別Taskの変更、symlink/submoduleは拒否する。
baseに保存済みのTask開始記録を置換してはいけない。未対応の変更面が必要な場合は、
通常経路で移行検査を先行拡張してから使う。候補のTask schemaの意味検査は候補checkerが担い、
旧checkerの受入条件から離れる判断は人が全差分を確認して担う。

Environment `aidd-contract-migration`には名前を指定した人のrequired reviewerを設定する。
個人repositoryでは所有者自身を指定でき、self review禁止は必須にしない。管理者のbypassは無効にする。
secretは登録しない。Environment不在、required reviewer不在、API取得失敗、実承認の欠落は失敗とする。
承認APIはread-onlyで照会し、agentが人に代わって承認しない。
[GitHub Environmentの保護](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)と
[runの承認履歴API](https://docs.github.com/en/rest/actions/workflow-runs#get-the-review-history-for-a-workflow-run)を使う。
team reviewerはこの実装では未対応で、個人reviewerを少なくとも1人指定する。

追加commitは新しいrunになり再検証・再承認を必要とする。古いrunは同じPRのconcurrencyでcancelし、
現在のheadとの一致検査でも拒否する。baseが変わった場合も申請と全検証を更新する。
申請後の本文変更も新runを起動し、実行eventの本文と現在本文の不一致を承認後にも拒否する。
同一commit/runの再実行はGitHubに保存された同じ承認を参照できるが、base/head/本文の不一致は許容しない。
同じSHAに対する通常の再実行と、新しい内容への承認流用を区別する。

この仕組みの初回導入PRは通常のbase checker検証で配信する。移行用commandがまだbaseにない状態では
移行へfallbackしない。導入後、既存の非互換PRは元Taskとbaselineを保持して使う。検査は現在のbaseソースを取得し、
差分はPR merge-baseからheadを照合する。移行経路を使うためだけにbaseをbranchへmergeする必要はない。
競合修正が必要なら元Task内で修正・全差分再検証し、baseline不一致などの失敗を隠さない。
CIの移行承認とローカルのchecker移行記録は別の責務である。ローカルでは上記の明示許可・移行記録・新証跡を要求し、開始時checkerの検証を成功と偽ったり、元Taskを作り直したりしない。

## Repository verification

### リポジトリ共通ゲートの採用判断（2026-09-12）

`vp`をリポジトリ全体のローカル検証ゲートとして採用し、commit前の整形・静的検査は
`vp staged`を共通入口にする。編集者や使用したAIに依存する検証漏れを防ぎ、
Push後のAIレビューでの指摘やCI失敗を減らすための判断である。

ルートの`vite.config.ts`はこの共通ゲートの設定を所有し、FE専用には扱わない。
`apps/web/vite.config.*`が所有するアプリの開発・ビルド設定とは責務を分ける。
`vp staged`は対象選択、処理の実行、stageと未ステージ変更の保護を担い、
Goの整形・静的解析そのものは`gofmt`と`go vet`が担う。
今後のcommit前検証も共通入口へ集約し、言語固有の検査は各ツールへ委譲する。

Go以外の変更でもchecker全体のvetを実行する現行方針を維持する。
FEや文書だけの変更であること、または設定ファイル名が`vite.config.ts`であることを理由に、
Go検証を外したり別の入口へ分離したりしない。CIはローカルの実行漏れを検出するため維持する。

### 実行手順

Gitのcommit前には`.vite-hooks/pre-commit`が`vp staged`を実行する。
ステージされた既存Goファイルを`gofmt -w`で整形し、`tools/aidd/checker`全体の
`go vet ./...`、既存の`vp check --fix`を順に実行する。Go以外の変更や削除のみのcommitでもvetを実行する。
未ステージ変更は検査中に隠して復元し、失敗時はcommitを止めてindexとworktreeを実行前へ戻す。
`.aidd/**`はcheckerがcanonical JSONを所有するため、汎用formatterの対象から除外してbytesを保持する。
フックを使う環境ではGoとVite+を利用可能にし、`vp hooks enable`でdispatcherを有効にする。
フックの整形は下記の検証より前に完了させる。AIDDの証拠取得後にフックが内容を変更した場合は、
変更後の状態を再検証する。CIの整形・vet検査は引き続き維持する。

具体的な必須commandは次のとおり。

```sh
go -C tools/aidd/checker mod verify
gofmt -l tools/aidd/checker
go -C tools/aidd/checker vet ./...
go -C tools/aidd/checker test ./...
go build -C tools/aidd/checker -o /tmp/aidd-candidate-checker ./cmd/aidd-checker
/tmp/aidd-candidate-checker check-all --repo-root .
python3 -B docs/harness/scripts/validate_accepted_adrs.py --repo-root . --base-ref origin/main
git diff --check
```

check-configは現行policyのglob、必須suite profile、rule-map、正本文書参照を検査する。
check-allは同じ設定検査と過去Requirements/Designの読取・表示同期を検査する。新規phase実行や旧receipt昇格は行わない。

## Repository policyの変更

scope禁止条件・条件付き必須検証・runner起動方法は`contracts/repository-policy.json`、
通常の必須検証routingは`contracts/protocol.json`で更新する。どちらもguardrailであり、
既存Taskの制約を変更するためにcandidateの値へ切り替えてはいけない。
開始時policyの読取互換性、技術アダプタの責務と既知の判定限界は
[architecture](aidd-checker.md#repository-policyと技術アダプタの境界)を参照する。
policy導入前のTaskは開始時の固定方針を維持し、導入後の新規実行にはpolicy fileが必要となる。
