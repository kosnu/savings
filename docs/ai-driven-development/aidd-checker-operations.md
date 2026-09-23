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
  - schema-v6
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

## 短い通常操作v6

新規記録はv6、既存v5 Taskは同じ形式・開始時checkerで継続する。
保存と復元の仕様は[compact protocol](compact-protocol.md)に従う。
明示Task IDと期待revisionでidentityを解決し、生成JSONの全文読込やhashの転記を通常手順にしない。

```sh
/tmp/aidd-task-checker task-start --repo-root . --source /tmp/task-spec.json
/tmp/aidd-task-checker task-status --repo-root . --task <id>
/tmp/aidd-task-checker checkpoint --repo-root . --task <id> --latest --expect-revision 0 --source /tmp/decision.json
/tmp/aidd-task-checker verify --repo-root . --task <id> --latest --expect-revision 1
/tmp/aidd-task-checker finish --repo-root . --task <id> --latest --expect-revision 1
```

task-specは下記契約を使う。schema_versionを省略すると6、intentのbody_sha256は省略時に本文から計算する。
初回Decisionではschema_version/kind/task_sha256を省略できる。要求・設計・許可は省略によって生成されない。
manual caseは従来どおり実際の観察を`--manual-observation 'VC-ID=観察結果'`で指定する。

再開時はtask-statusを読み、必要なfieldだけを`--field decision`等で取得する。
`next_offset`がある場合は`--offset <next_offset>`で続ける。既定2000文字、`--limit`の最大は4000文字。
証拠整合成功はreview・配信完了を意味しない。表示されたrevisionが変わったら読み直す。

判断の改訂はreasonと変更項目だけを外部JSONへ記録して実行する。

```json
{
  "reason": "観測結果に基づき表示の説明を明確化する",
  "product_behaviors": {
    "upsert": [
      {
        "id": "PB-1",
        "type": "state_transition",
        "description": "変更後に観測できる結果",
        "requirement_id": "FR-1"
      }
    ]
  }
}
```

```sh
/tmp/aidd-task-checker decision-update --repo-root . --task <id> --expect-revision 1 --source /tmp/update.json
/tmp/aidd-task-checker verify --repo-root . --task <id> --latest --expect-revision 2
```

caseやownershipなどの変更も対応するcollectionのupsert/removeへ記載する。
旧証跡は全失効し、改訂後の全体を検証する。stage後のship-checkも
`--latest --expect-revision <最新revision>`を使用できる。公開操作とread-backの責務は変えない。
失敗出力の続きを必要とする場合は`--diagnostic-offset`を指定する。これは同commandの再実行であり、
状態や検証結果が変わる場合は前回出力と連結しない。

以降のhash明示commandは低水準の操作・既存Task互換経路として維持する。
新checkerの利用だけで旧Taskの実行checkerを差し替えてはいけない。

## Task contract

sourceはrepository外のregular non-symlink JSON。出典本文を取得した後にSHA-256を計算する。
`action: execute`は実行依頼からのみ設定する。質問・説明・調査をexecuteへ読み替えない。

```json
{
  "schema_version": 6,
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
IssueなしのDevelopmentでは`intent.kind: message`とし、`reference`へ元の発言を特定できる参照（例: `user:<conversation>/<message>`）、
`body`へユーザー発言の本文、`authorization`へ実行を依頼された根拠を記録する。`action: execute`だけで発言の意味を認証したとは扱わない。
Issue指定の既存Developmentは従来の記録を保持して読む。
Learnは`kind: learn`とし、出典は`issue`、`message`または既存の`feedback`を使える。Issue URLは必須ではない。
明示的な変更依頼の`authorization`と、`authorized_scopes: [{"path":"対象","kind":"file"}]`
を追加する。pathは初期計画の有限file/tree。ユーザーが明示したファイル上限は任意の
`user_scope_limits`へ別に記録する。Task種別にかかわらず実際の許可範囲を検査する。

```sh
/tmp/aidd-task-checker task-start --repo-root . --source /tmp/task-spec.json
```

.aiddの正本identityは明示Taskから解決する。正本は`.aidd/tasks/<id>/task.json`。
Taskは開始時HEAD、全non-ignored baseline、policy/rule-map/profileのbytes、checker hashを固定する。
v6ではGitから復元可能な情報を埋め込まず、必要なローカル権限例外を保持する。
既存Taskを上書きせず、baselineを取り直さない。Taskの開始前に実装を持ち込まない。
既存成果の追加配信では、このcommandを再実行する前に
[workflowの継続境界](workflow.md#追加配信とtaskの継続)を確認する。
別IDとcleanなworktreeでtask-startが成功しても、既存Taskの置換が許可されたことにはならない。

## Decision / checkpoint

Learnから開始したTaskでは、product実装が許可された時点で同じDecisionへ
`product_authorization`を追加する。これは作業範囲の追記とは別の根拠であり、Taskの再作成は不要である。

```json
{
  "product_authorization": {
    "intent": {
      "kind": "issue",
      "reference": "https://github.com/owner/repository/issues/123",
      "body": "取得したIssue本文",
      "body_sha256": "本文のUTF-8 bytesのSHA-256"
    },
    "authorization": "ユーザーの実装依頼と、その依頼が対象Issueを実行する根拠",
    "scopes": [{ "path": "apps/web/src/features/example", "kind": "tree" }]
  }
}
```

実際の出典本文と依頼を確認し、対象scopeをpath順で記録する。
Issueなしでは上記`intent`を`kind: message`とユーザー発言の参照・本文・hashへ置き換える。
feedbackの存在だけでproduct実装を許可せず、人間の実行依頼を出典に使う。既存のownership・必要な
scope_revision・verificationも同じDecisionに含め、実装前にcheckpointを作る。
Development開始時の実行依頼で許可済みの場合は追加記録も再承認も不要である。
追加した記録は後続Decisionに保持する。scope外の実装追加には対応する実行許可が必要であり、
`user_scope_limits`は解除できない。product fieldや依存closureだけの変更にも同じ検査を適用する。
checkerは出典参照・本文hash・許可記録・対象pathを検査し、Issueや発言の真正性や
許可文の意味を自動認証しない。これらは担当agentが元の依頼と照合する。

Decision sourceはTaskと同じschema_version（新規6、既存5）、kind decision、task_sha256、reason、requirements、
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

## AIDD変更Coverageの操作

AIDDの仕組みと実行入力を変更するときは[変更Coverage](change-coverage.md)を適用する。
初回Decisionに`change_coverage`を記載し、概念ごとのrepresentationと5軸の判断を固定する。
次の表示はTask開始時モデルと最新判断を返す。通常のpage/offset契約を使う。

```sh
/tmp/aidd-task-checker task-status --repo-root . --task <id> --field change_coverage_model
/tmp/aidd-task-checker task-status --repo-root . --task <id> --field change_coverage
```

改訂は`decision-update`の`change_coverage: {"upsert": [...], "remove": [...]}`へ概念ID単位で指定する。
省略時は保持する。判定変更後は旧Evidenceが失効し、通常のverifyで全caseを実行する。
新Taskではモデルfileが必要。開始時モデルのない旧Taskはmanual caseとreasonで評価を残し、
新fieldや候補binaryを使うためにTaskを作り直さない。

## Intentの補足・訂正

Task開始時のIntentを上書きせず、新checkpointへ`intent_revision`を追記する。以下はrevision 1のTaskへの
要求追加例。採用した要求に対応するbehavior・case・representationも同じ更新で結び付ける。

```json
{
  "reason": "ユーザーが同じ成果の受け入れ条件を補足したため要求を改訂する",
  "intent_revision": {
    "intent": {
      "kind": "message",
      "reference": "user:conversation/message-2",
      "body": "Bot作成PRでも失敗しないようにする",
      "body_sha256": "bdd87fe0686a8bcd6428ab2d75103b2ffc7963822ca781b28ea67b72bbdbdb8e"
    },
    "reason": "Bot作成PRの成功条件が不足していた"
  },
  "requirements": {
    "upsert": [
      {
        "id": "FR-2",
        "text": "Bot作成PRでも失敗しないようにする",
        "origin": "intent",
        "evidence": "Bot作成PRでも失敗しないようにする",
        "intent_revision": 2
      }
    ]
  }
}
```

```sh
/tmp/aidd-task-checker decision-update --repo-root . --task <id> --expect-revision 1 --source /tmp/update.json
/tmp/aidd-task-checker task-status --repo-root . --task <id> --field intent_sources
```

要求の`intent_revision`は出典を記録したcheckpoint番号を指す。省略または0はTask開始時の出典を使う。
出典の本文に`evidence`が実在することを検査する。guardrail/derived根拠にこの参照を混在させない。
Issue更新も同じ形式で取得したIssue本文・参照・hashを追記できる。複数の発言は出典ごとにcheckpointへ記録する。
訂正では対象要求をupsert/removeして現在の意味を更新し、過去の出典・要求・checkpointは保持する。
`decision-update`では省略した出典イベントを再適用しない。低水準の`checkpoint`へ前回Decisionを渡す場合は、
新しい補足がなければトップレベルの`intent_revision`を除去し、要求内の出典参照は保持する。

Intentの追加自体は実装許可ではない。元の依頼の委任範囲と明示制限を確認し、必要な追加許可は別に記録する。
意味的な矛盾や独立した新規作業かどうかはagentが判断する。形式検査だけで人間の意図を確定しない。
改訂後の全caseをverifyし、旧Evidenceを流用しない。新fieldを使うには対応checkerが必要であり、旧Taskは
開始記録を保持した[checker移行](#旧taskのchecker移行)、base未対応の配信は[契約移行](#非互換なchecker契約の移行)を使う。
新fieldを使わない実装Taskの配信は既存base checkerで検査でき、この機能追加だけで移行経路を要求しない。

## Learnの判断と検証の接続

[Learning Extraction](../harness/policies/learning-extraction.md#決定論的検出可否)の評価を、
許可された更新では既存Decisionへ次のように接続する。分析だけの場合は分析結果へ記載し、
記録のためにTask・checkpointを作成しない。

| 判断・成果                                                                              | 既存の記録先                                              |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| findingと入力元、検出可否と根拠、対策比較・採否、機械化しない理由、残る意味判断と担当者 | `reason`。複数findingは入力元との対応が分かる形で記載する |
| 防ぐ違反と維持する正常挙動                                                              | `requirements`と`target_state.product_behaviors`          |
| 採用した対策の実装・正本・routing・テスト                                               | `target_state.ownership_scopes`と`representations`        |
| 違反の検出、正常入力の受入、必要検証の選択・実行経路                                    | `target_state.verification_cases`と成果物からのcase参照   |
| 検証の実行結果、残る意味判断のreview観察                                                | 最新checkpointに対する`verify`のEvidence                  |

各behavior・case・representationは対応するrequirementへ結び付ける。変更不要のfindingには
不要な成果物やcaseを作らず、`reason`に根拠を残す。現行v5/v6では機械化可否の専用fieldはなく、
上記の既存Decisionを使う。Coreは検出可否や文章の妥当性、全findingの列挙を自動判定しない。
記述量は[出力構造](../harness/policies/learning-extraction.md#出力構造)に従い、各欄へ同じ分析を転載しない。
未確定部分は`reason`に不足点と保留範囲を残し、採用済み成果物や成功した検証として記録しない。
独立して確定した許可済み部分は、同じTaskで変更・検証を続ける。

検出機構を変更する場合はautomated caseへ回帰検証を接続する。既存profileから実行できる
suiteまたはtest selectorを選び、必要な通常経路で実行されることも確認する。新profileを追加しても
開始時catalogは置き換えず、候補検証と後続Taskでの適用条件を分けて記録する。
文書上の判断基準や残る意味判断はmanual caseのprocedureへ具体例と観点を記載し、
実際のreview結果を`--manual-observation 'VC-ID=観察結果'`で渡す。

既存Taskでは変更前に`decision-update`または`checkpoint`で新revisionを作り、全caseを再検証する。
判断やcaseを改訂した後に旧Evidenceを再利用しない。開始時checker・policy/profileは維持し、
後続Taskへの適用を現在のTaskの固定契約の置換と混同しない。

## Learnの変更対象の改訂

初期`authorized_scopes`を超える作業が委任内で必要になった場合、元の許可文と制約を確認し、
実装前に既存Decisionへ次のイベントを追加して通常の`checkpoint`を実行する。
`target_state`にも追加scope・成果物・検証を反映し、最新checkpoint hashを親として指定する。
追加範囲を許可する前に、既存の許可範囲で変更判定基準からの実差分を検査する。
最終状態ではownership内の全ファイルとrepresentationのpathを完全一致させ、
宣言した成果物のpathに必要なsuiteを要求する。新規ファイルを成果物へ宣言せず完了する経路は
最終inventory検査が拒否するため、未検証で完了できる正常経路には含めない。
検証ケースとの対応はtarget_state全体で保証し、実装とは別のテスト成果物が検証ケースを担える。
個々の実装representationの検証参照が空であることだけを検証漏れとは扱わず、
全ケースの参照・必須suiteの選択・実行証拠で判定する。

```json
"scope_revision": {
  "added_scopes": [{"path": "tools/aidd/checker/internal/protocol/example_test.go", "kind": "file"}],
  "reason": "レビューで同じ目的の回帰テストが必要と判明した",
  "boundary_review": "元の許可文・制約を確認した結果と、目的・影響範囲・配信先を広げない根拠を記録する",
  "reviewer": "実際に判断した担当者"
}
```

`added_scopes`は新たな有限file/treeをpath順で指定する。初回checkpoint、重複追加、checker出力、
禁止treeの追加は拒否する。過去のイベントは履歴から再構成するため、次のcheckpointへ
同じ`scope_revision`を再掲しない。さらに追加する場合だけ新しいイベントを記載する。

旧Taskの許可文にファイル単位の上限がある場合は、イベントの`user_scope_limits`へ
`[{"path":"許可されたpath","kind":"fileまたはtree"}]`の形で記録する。
Task開始時または過去イベントの制限はすべて適用され、後続イベントの省略や広い範囲の自己申告では解除できない。
元の明示制限を見落とさないことは`boundary_review`で確認する。意味や出典の真正性をcheckerが証明するわけではない。

Taskのbytes・baseline・開始時checker・policy/profileは変更しない。改訂後は旧証拠を使わず、
全caseを`verify`し、`check`・`finish`・配信時の`ship-check`を実行する。
改訂機能は開始時catalogを拡張しないため、新profileの利用可否も固定したcatalogに従う。

新fieldを使わない旧Taskはcanonical bytes/hashを変えず読み取る。旧binaryは新fieldを受け付けないため、
実行binaryの更新が必要な既存Taskでは下記の明示的なchecker移行と全再検証を使い、Taskを作り直さない。
通常のbase CIで非互換になる場合は非互換契約のCI移行経路も必要であり、candidate成功だけでは受け入れない。
本機能の導入Task自体は旧fieldだけで開始時checkerによる検証を完了できる。

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

開始時checkerが必要な継続機能を扱えないTaskは、許可されたchecker移行を新checkpointへ追記する。
Taskの開始記録、元baseline、旧policy/profile、旧checkpointと旧証跡を保持し、新Taskで置換しない。
移行先binaryを独立にbuildしてSHA-256を取得し、外部Decision sourceへ次を追加する。

- `checker_migration.from_checker_sha256`: 現在の実行checkerのhash（初回はTaskの開始時hash）。
- `to_checker_sha256`: 以後の実行に固定する移行先binaryのhash。
- `from_checkpoint_sha256` / `from_evidence_sha256`: 最新checkpointとその既存証跡のhash。
- `authorization`: 移行と必要な追加修正について実際に得た明示許可。
- `authorized_scopes`: 追加修正を許可された有限のfile/treeをpath順に列挙。追加がなければ空配列。

Developmentでは`authorized_scopes`を空配列にする。ルール保守と必要なchecker更新の許可根拠を記録し、
通常のDecisionでルールの変更・検証も扱う。初回検証を阻まれ、親checkpointの証拠が存在しない場合は
`from_evidence_sha256`を空文字列にする。証拠が存在する場合はそのhashを必ず指定し、省略しない。
移行はproductやguardrailの変更権限を追加せず、Taskの元の権限とユーザーの明示制限を維持する。

移行先binaryで通常の`checkpoint`を実行する。初回の移行記録は現在checkpointを参照する場合だけ受け付け、
実行binaryのhashを移行先と照合する。以後のcheckpointは同じ移行記録を保持する。再移行はその時点の
checkpoint・証跡・実行checkerから追記し、記録の除去は拒否する。Taskの初期作業範囲の記録を上書きせず、追加の許可は
移行記録の履歴へ残す。ユーザーの明示制限を超える変更は拒否する。

必要なら同じDecisionに`integration`を指定し、全差分のownership・要求・verificationを具体化する。
旧証跡は移行元の履歴参照であり、現在状態の成功根拠にしない。移行先binaryで全caseを再verifyし、
そのbinaryのhashと新checkpointへ結合した証跡でcheck・finish・ship-checkを行う。
既存の複数Taskを同じPRへ反映する場合は記録を保持し、各Taskの担当範囲を最終ソースで再検証する。
ルール保守を理由に新しいTaskを要求しない。

対応済みのtrusted base checkerは、Task種別にかかわらず通常の`ci-check`で移行後の証拠を検査する。
base checkerが新契約を扱えない場合だけ、下記の非互換契約移行経路を使う。
`ci-check --contract-migration`も全Taskの履歴・差分・証拠を検査し、base側の限定差分検査と
GitHub Environmentによる人の承認を省略しない。実行checkerの移行とCI受入契約の変更は区別する。

## ルール変更の採用

ルール保守は既存Taskの通常の変更として扱う。

1. 許可された変更理由・対象と検証をDecisionのownership・representation・caseへ記録する。
2. 同じTask・ブランチでアプリ実装とルールを修正する。先行commitや専用の採用fieldは不要。
3. 変更後のルールを読み、rule-mapを変えた場合は新checkpointで更新後の索引とclosureを保存する。
4. `verify`・`check`・`finish`で担当範囲と最終ソースを検証し、配信時は`ship-check`を実行する。

開始時checkerがこの継続方式に未対応なら、上記のchecker移行を記録して対応binaryへ移行する。
Task開始記録と旧checkpoint・証拠を保持し、Task再作成で古い差分を隠さない。
`TestDevelopmentEditsProductAndRulesWithoutSeparateTaskOrCommit`、
`TestCheckpointUsesUpdatedRuleMapWithoutImportCommit`、`TestSameBranchTasksShareDeliveryAndKeepTheirRecords`、
`TestOldDevelopmentCheckerMigratesAndContinues`で継続・索引更新・複数TaskのCI・旧Task移行を確認する。

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
通常操作は最新identityを解決する。hash明示経路では成功出力を使用する。正本は`evidence/<checkpoint-hash>.json`。

```sh
/tmp/aidd-task-checker check --repo-root . --task <id> \
  --task-sha256 <task-hash> --checkpoint-sha256 <checkpoint-hash> \
  --evidence-sha256 <evidence-hash>
```

改訂または対象変更で旧証拠は失効する。全caseを再実行する。
`check`は整合検査であり、意味的reviewやLearn確定の代わりではない。

## Learn確定

変更開始時のbinaryでverifyを完了する。担当agent自身が最新差分と検証証拠をreviewし、
ユーザーの明示制限と、最新checkpointで検証した作業範囲に従って確定する。独立reviewや別agentの呼び出しは、ユーザーが明示的に依頼した場合だけ行う。

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

既に許可されたproduct実装は同じTaskで継続する。追加の実装が許可されていなければ、その必要性とIntentの出典を示す。

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

変更された全Taskを検査する。Task数を制限せず、各Taskの開始時policy/profileとGit baseline、
最終content/Git mode、rule/ownership/verificationを確認し、その和集合でPR差分を覆う。
各Taskの変更基準はPRの履歴上にあり、統合時は現在のtarget baseと一致する必要がある。
`--task`の指定でも他の変更Taskの検査を省略しない。ソースが変わったら各Taskを最終状態で再検証する。
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
   移行申請のためにownershipへ新規fileを追加したりTaskを再作成したりする必要はない。本文の編集は新しいCI runを起動する。
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

移行差分はrootの`AGENTS.md`、`tools/aidd/`、`docs/ai-driven-development/`、`docs/harness/`、`docs/adr/`、
AIDDのskill path（現行のlearn・goal-settingと、移行互換として許可する旧aidd-cycle・harness-taskのパス）、`aidd_checker_ci.yaml`と
Task記録に限定する。checkerまたはcontract変更を必須とし、
product、混在package設定、他のCI、symlink/submoduleは拒否する。
複数Taskの記録は許可し、候補CIで各Taskの履歴と証拠を検査する。
`AGENTS.md`は契約変更に伴う入口の同期として扱い、単独の変更では移行を成立させない。
未知のpathをprefixで許可せず、候補による許可リストの自己拡張も使わない。
baseに保存済みのTask開始記録を置換してはいけない。未対応の変更面が必要な場合は、
通常経路で移行検査を先行拡張してから使う。候補のTask schemaの意味検査は候補checkerが担い、
旧checkerの受入条件から離れる判断は人が全差分を確認して担う。
先行拡張をmainへ取り込んだ後、契約変更PRは現在のbase/headで申請を更新して再検証する。

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

必須検証のroutingは、検査対象だけでなく動作や検証方法を変える実行入力も対象にする。
共有ゲートの回帰suiteは`shared-gate-tests`。`protocol.json`はルート`vite.config.ts`、
`.vite-hooks/**`、回帰テスト自身に加え、`protocol.json`、`verification-profiles.json`、
ルート`package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`の変更にもこのsuiteを要求する。
`git-diff-check`やWeb suiteだけのDecisionでは条件を満たさない。
protocol/profileの変更には、routingと起動コマンドの契約を検査する`aidd-checker-tests`も要求する。
これにより、suite名を残した起動先変更や必須対象の欠落も回帰テストで検出する。
依存定義はファイル単位で保守的に選択し、変更fieldごとの対象判定は行わない。
`verification-profiles.json`が次の起動方法を所有する。

```sh
python3 -B -m unittest -v tools.aidd.tests.test_shared_gate
```

依存をインストール済みのrepositoryでPython 3、Git、Go、Nodeと`node_modules/.bin/vp`を使う。
suiteは設定とフックを一時Git repositoryへコピーし、実際のcommitから`vp staged`を実行する。
Go整形、vet失敗によるcommit停止、非Go・削除のみのvet、成功・失敗時の未ステージ差分保護、
`vp check`の整形と`.aidd` JSONのbytes保持を確認する。元repositoryのindexやHEADは変更しない。
Goのfixtureは一時repositoryの`tools/aidd/checker`に置き、Go/vpの実行をmockへ置き換えない。
開始時profileを固定したLearnでは既存`aidd-python-unittest`で同じテストの各methodを実行し、
新suiteのroutingと省略拒否はchecker回帰テストで確認する。

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
