---
title: AIDD Checker Architecture
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

# AIDD invariant / integrity checker

Coreは`tools/aidd/checker/internal/protocol`。schema v5/v6のTask、Decision、checkpoint、evidenceを
検査し、phase順序、Goal lifecycle、model、executor、agentのStop判断を制御しない。
Codex Hookは`internal/adapters/codex/hooks`に置き、Coreから参照しない。

## 保存する保証

既存のsemantic target検証、catalog、rules、repository snapshot、state、runner、evidenceを共有する。
要求→behavior→verification→representationの参照、finite ownership、最終inventory、path/surface
closure、profile-fixed argv、test selectorの実行identity、stream/output hashを検証する。
manual観察の形式検査を意味的正しさの証明とは扱わない。

Task開始時の全non-ignored状態、Git HEAD、policy、rule-map、profile bytes、checker executable hashを固定する。
新規v6ではGitから復元する情報を重複保存せず、必要なローカル権限例外だけを保持する。開始にはcleanな専用worktreeを要求する。
Taskとcheckpointはmode 0600のcanonical JSONとしてatomic writeし、既存recordを上書きしない。
v5のraw policy/profile bytesはbase64のまま読取互換性を維持する。v6は開始commitから元bytesを復元する。
保存schema、snapshot、状態digestの契約は[compact protocol](compact-protocol.md)に従う。

checkpointはTask hashと親checkpoint hashを持つ追記型revision。baselineを持ち直さない。
最新checkpoint以外の証拠、対象content/mode/inventoryが異なる証拠を拒否する。
検証時はtask外を含むrepository stateに証拠を結び付ける。

runnerは専用process groupを使い、残留processを終了・拒否した後にGit管理対象と
未ignoreの新規fileのmutation manifest、HEAD、staged treeを比較する。GIT_*の注入を除去する。
Git管理対象はignore指定があっても検査し、未追跡fileの選択にはGitの標準ignore設定を使う。
ignore対象の未追跡生成物・cacheは原則除外し、生成物ごとの例外リストは設けない。
rootと親directoryの更新時刻を比較しないため、正常な生成物の作成・削除でも拒否しない。
既存の対象fileのcontent/mode/identity、HEADとindexの検査は維持する。
対象fileの追加・削除は検証前後のinventoryで検出する。snapshot間に作成して削除された
未追跡fileや空directoryの一時変更は保証範囲に含めない。
明示された所有成果物のhash検査は別に維持し、ignoreを成果物検証の免除には使わない。
canonical JSON、snapshot bytes、path traversal/symlink拒否、出力mode検査を継承する。

Shipは検証済みworktree全体とindexのcontent/Git modeが一致し、未stage出力がないことを要求する。
CIはclean candidateのGit転送を検証し、baseのcheckerでTask baselineを実際のGit treeへ照合する。
Gitは0600などのローカル権限を保存しないため、CIではblob contentとGit modeを比較する。
ローカル検査の0600要件は緩和しない。

Taskの配信区分は持たない。旧v5のdelivery fieldはcanonical bytes/hashの読取互換性だけに残し、
新規Taskでは省略する。finishは証拠整合、Shipは追加でindex整合、CIはGit転送後の整合を検査する。
操作許可の判断は実行agentが担い、Coreの成功を公開操作の許可には使わない。
旧binaryの固定条件は維持し、互換性の限界は[operations](aidd-checker-operations.md#ship--ci)に従う。

## AIDD変更のCoverage

[変更Coverage](change-coverage.md)がモデルと判定の正本を所有する。Coreは開始時Git treeへ固定した
`contracts/change-coverage.json`から必須軸を復元し、Decisionの概念・representation・パターン・case参照を検査する。
候補のモデルによる必須項目の削減は認めない。モデルのない旧Taskは従来条件で継続する。
意味判断はAgentが担い、列挙された軸と参照の整合をCoreが担う。検証は既存Evidenceへ結合する。

## 統合記録と変更判定基準

Decisionの省略可能な`integration`は`base_head`と`head`の完全commit IDを持つ。
Task開始点→統合base→統合head→現在HEADのancestor関係をGitで照合する。
checkpoint履歴を読み直す際にも全統合記録を検査し、base/headの後退と記録の除去を拒否する。
変更判定用inventoryは指定baseのGit treeから取得する。Taskの保存済みbaselineやpolicy/profileは書き換えない。

権限と変更pathの比較はGit modeで行う。証拠は従来どおりTask外を含む全inventoryに結合し、
ローカルのcontent/mode変更も検査する。CLIのcheckpoint/verify/check/finish/ship-checkとCIで同じ基準を使う。
統合recordはcheckpoint hashを通じて証拠と結合し、旧証拠の部分的な流用はしない。
CIは呼出側の信頼された`--target-base`と統合baseの完全一致、を要求する。Task開始点とPR基準点の一致は要求せず、差分の検証coverageで判定する。
ローカルのGit包含関係だけでは、そのcommitがmainであることを認証できない。baseの取得責務はagent、
CIではGitHub eventから値を渡すworkflowが担い、candidate記録をtrusted baseの取得元にしない。

旧v5記録はfield省略時のcanonical bytes/hashを保持する。統合記録を持つcheckpointは対応checkerを必要とする。
統合fieldでcheckerの固定を解除しない。旧Taskの実行checker移行は、別の`checker_migration`を追記する。
移行元checkpoint・既存証跡・checkerと移行先checker、明示許可、追加の有限scopeを記録し、過去記録は保持する。
ローカルでは実行binaryを移行先hashに固定する。Task種別にかかわらず、対応済みのtrusted base checkerで通常CIを行う。
base checkerが新しい契約を扱えない配信だけ、承認付きの契約移行経路を使う。
hashは承認者の認証ではなく、ローカルの許可判断はagent、CIの受入承認はbase側migration jobが担う。

## 作業の継続とルール更新

Development / Learnの種別からファイルや設定fieldの変更禁止を導かない。
許可範囲・ownership・representation・必須検証を通常のcheckpointと証拠で確認する。
product pathの実差分には、Development開始時の実行依頼、または最新Decisionの`product_authorization`を要求する。
出典はIssueまたはユーザー発言であり、後者の許可記録は本文・出典・hash、実行許可、path順の有限file/tree scopeを持ち、差分のpathを覆う。
初期`authorized_scopes`や`scope_revision`だけではこの検査を代替できない。
記録済みのDevelopment実行依頼は再利用し、Task種別による禁止や別Taskへの移行は要求しない。
出典本文の取得・許可文の真正性・依頼との意味的な対応はagentの責務であり、hash検査で証明したとは扱わない。
新checkpointは現在のrule-mapへ結合し、その索引のpath/surface・depends_on closureを計算する。
v6は開始commit参照またはTask内で共有するsnapshot参照を保持し、v5は従来どおりbytesを保存する。
文書の新規作成も扱い、未commitであることや開始時inventoryに存在しないことだけでは拒否しない。
索引変更後はcheckpointを更新する。過去checkpointは保存した索引、旧形式は従来のTask索引で読み、hashを保持する。
変更後の文書と索引は全ソースの検証証拠に結合する。先行commitや`rule_revision`は不要である。

## Intentの出典と追記

IntentはIssue表現から独立し、`issue`、`message`、既存Learn互換の`feedback`を出典種別として読む。
Developmentのmessage開始には実行許可の記録を要求する。Learnの開始出典や意図の追記だけではproduct実装を許可しない。
`Decision.intent_revision`は出典snapshotと補足・訂正理由を持つ一回限りのイベント。要求の`intent_revision`は
出典を持つcheckpoint番号を参照し、省略/0はTask開始時を指す。履歴順に出典を復元し、未知・将来の参照や本文にない根拠を拒否する。
開始Taskと過去のcheckpointを改変せず、通常のcheckpoint/Evidence結合で旧証拠を失効させる。
`decision-update`は既存の要求参照を保持し、出典イベント自体を再適用しない。
新field省略時は既存v5/v6記録のcanonical bytesを保持する。新fieldを使う実行には対応checkerが必要であり、
旧Taskのchecker固定やtrusted baseの移行境界は[operations](aidd-checker-operations.md)に従う。

## Learnの信頼境界

Learnの作業範囲は初期`authorized_scopes`とcheckpointの`scope_revision.added_scopes`から構成する。
`authorized_scopes`は初期の有限作業範囲、`scope_revision`は同じ委任内で必要になった範囲の追加と
根拠付きレビューを記録する。現在のownershipと成果物は最新Decisionの`target_state`が表す。

ユーザーが明示したfile/tree上限は`user_scope_limits`が表し、作業予定の一覧と区別する。
Taskと各checkpointに記録した上限をすべて満たすownershipと実差分だけを受け入れる。
範囲追加やchecker移行は、ユーザーの明示制限を解除しない。
追加パスにはcheckpoint時のrule-mapと開始時policy/profileを適用し、必要なruleとsuiteを計算する。

Learnは開始時binary、または明示的な移行checkpointが指定するbinaryを使う。
記録なしのcandidate置換を拒否し、policy/profileはTaskが保持する開始時bytesから解決する。
作業範囲の改訂後は旧証拠を失効させ、変更判定基準からの全差分と最終inventoryを再検証する。
混在package設定とlockfileは[設定・依存関係の保護](#設定依存関係の保護)に従い、tool更新の同期を許可する。

委任内かという意味判断と許可文・確認者の真正性は担当agentが確認し、有限範囲・明示制限・
禁止領域・履歴・検証証拠の整合はCoreが検査する。JSONやhashは署名ではない。
新checkerのtest成功だけではLearnを確定せず、担当agent自身が最新差分とevidenceをreviewする。
Learnのfinish/Ship/CIは独立review記録を要求しない。別agentへの委譲はAGENTS.mdの費用対効果条件に従う。
確認が必要になる境界は[workflow](workflow.md#rule--ownership--guardrail)、
操作手順と旧Taskの互換性は[operations](aidd-checker-operations.md#learnの変更対象の改訂)を参照する。

## 設定・依存関係の保護

設定や依存関係も、Taskの種類にかかわらず許可されたownership内で更新できる。
混在JSONとlockfileは既存のtype/modeと構造・参照の整合を検査する。
product / toolの分類は実装許可の照合に使い、変更を別Taskへ隔離するためには使わない。
混在JSONはproduct fieldの投影差分、lockfileはproduct依存closureの差分がある場合に実装許可を要求する。
toolだけの変更はその許可を要求せず、両側の依存参照と構造を引き続き検査する。
検証コマンドは開始時policy/profileから解決し、変更した設定で検証を黙って省略しない。

## 運用前提と限界

専用worktree・単一writer、信頼された開始時checker/Git/OS、明示的に許可された操作を前提とする。
同一worktreeへの外部並行writer、直接の.git改変、binary置換を攻撃的に隠すOS操作は防御対象外。
checkerが自己申告された意味を証明したり、暗号署名なしで証拠作成者を認証したりはしない。
agentは解釈、戦略、設計、reviewを担い、checkerは決定論的な整合を検査する。

clean start、checkpoint改訂時の全失効、逐次verificationを採用する。PRのTask数は制限しない。
1 Task内の複数commit・PR review後の再開・main取り込みに対応し、元baselineを維持して全体を再検証する。
統合後の変更判定基準はcheckpointの`integration.base_head`であり、開始点と分離する。
複数Taskの担当差分を合成して配信できる。各Taskの開始点はPR基準点以降の履歴に含まれ、
PRの全ソース差分は、そのpathのPR基準状態から検証したTaskの証拠で覆う。
全Taskの最新証拠を最終ソースへ照合する。Task生成記録は全ソースhashから除外して個別に検査する。
共有worktreeへの並行writerと、ソース変更後の部分証拠再利用は未対応。

## 実装責務

- protocol: v5/v6 task / decision / checkpoint / verification / delivery。
- semantic / state / rules: targetとownershipの構造、宣言されたscope制約、rule graph、最終状態。
- repositorypolicy: repository固有のscope制約、条件付き必須検証、runner起動方針。
- adapters/storybook、adapters/pnpm、adapters/testrunner: source・依存関係・テスト結果から技術的事実を抽出する。
- repository: Git、filesystem、snapshot、atomic output、mutation manifest。
- verificationcontract / runner / evidence: agent非依存の実行入力と証拠。
- adapters/codex: Codex lifecycle支援。正本状態・公開許可を所有しない。
- gates / handoff / receipt / render: historical v4保証の読取・回帰用。新規実行の公開入口はない。

AIDD制御ロジックはGoで実装する。新しい言語の互換実装を追加しない。

## Task間のbinary再利用

`cmd/aidd-prepare`と`internal/binarycache`はCoreの外で開始時binaryを準備する。
再利用入力はchecker tree（ソース・依存定義・testsを含む全regular file）、contracts tree、
rule-mapとそこから参照する正本文書、および正規化したGo host環境である。
入力集合の所有者はbinarycacheであり、呼出側に契約pathやbuild flagsの上書きは公開しない。
checker treeは実際のbuild元、contractsはschema・検証profile・旧artifactの読取契約、
rule-mapと正本文書は適用判断との対応を固定するために含める。Task・Issue・引数・アプリコードは含めない。
入力hashごとにmanifestとbinary hashを保存し、取得前に照合する。hashは同一性であり、
意味的互換性や真正性を証明しない。既存schema・必須項目検査はCoreが引き続き担当する。
Taskが固定するexecutable hashとpolicy/profile bytesは変更しない。Learn候補の準備は別pathとなり、
開始時checkerの代替にはしない。

CIのbase検証では、候補コードが書けるcacheを信頼済み実行物の取得元にしない。
baseソースを別directoryへ展開してcheckerを直接buildし、Go build/module cacheもその新規directoryへ分離する。
ソースの取得元だけでなく、実行物の取得経路もbase側の責務である。hash照合はこの隔離の代替にならない。
base検証はcandidate検証と別jobで実行し、候補コードを実行する前提を持たない。
Goはbase checkoutのgo.modから選び、候補側のGo版やGITHUB_PATH/GITHUB_ENVの変更を引き継がない。
初回bootstrapのみcandidate jobで実行する。通常Task間のbinary再利用とは信頼する入力が異なる。

## 非互換契約のCI移行境界

通常のbase checker検証に加え、明示された契約移行では`internal/migration`と
`cmd/aidd-migration`をbaseからbuildして使う。Task schema自体の変更に対応するため、
この境界はTaskの旧schemaを再解釈せず、Gitの対象差分・regular blob・既存Task identityと
PR本文の固定形式の移行申請を照合する。候補schemaの整合性は候補のci-checkで検査する。
旧契約を置換する意味的な判断は、対象runのGitHub Environmentに記録された人の承認が担う。

candidateのコードを実行するjobと、baseの差分・承認検査jobは分離する。
base sourceとGo cacheの隔離は通常検証と同じである。candidateが書けるartifactや自己申告のJSONを
承認の証拠にしない。現在のPR base/headと本文、runのhead、Environmentと人のreviewerをGitHubから照合する。
取得できなければ成功にしない。workflow自体の変更のreviewとGitHub管理権限を信頼境界に含む。
repository管理者によるworkflow・保護設定の意図的な変更まで防ぐ仕組みではない。
操作・差分範囲・初回導入は[operations](aidd-checker-operations.md#非互換なchecker契約の移行)を正本とする。

## Repository policyと技術アダプタの境界

`contracts/repository-policy.json`はschema_version 1、kind `aidd_repository_policy`の機械可読contract。
この節を方針の所有文書とし、`forbidden_tree_scopes`は広すぎるtree ownershipを、
`conditional_verification`は対象path・観測する事実・必要suiteを、`runner_argv_prefixes`は
repositoryで採用する起動方法を宣言する。使用するtest-case runnerにはprefix宣言を必須とする。
`profile_invocations`はsuiteのprofile IDごとにrunner・working directory・argvの完全一致契約を宣言する。
現行policyはgit-diff-checkの起動契約を保持し、その宣言に反するcatalogの他commandへの置換や
対象を狭める引数追加を拒否する。
このfieldを持たない既存policyの読取は維持する。通常の必須suiteは既存の`protocol.json`の
`required_verification`が所有する。全変更のgit-diff-checkもその宣言によって必須となり、
Coreやcatalogでprofile名を特別扱いしない。profileのargv自体は引き続き開始時bytesに固定する。

新規実行とcandidate設定検査ではrepository policyの存在、形式、参照suite、guardrail分類を検査する。
開始時inventory（v6はGitから復元）に含まれるpolicyのhashと
開始時Git treeのbytesを照合して読み取る。統合baseやcandidateのpolicyで開始時policyを置き換えない。
旧Taskにこのfileがない場合だけ、`repositorypolicy/legacy.json`に隔離した旧方針で読み取る。
historical artifactは旧形式の契約と旧方針で読取検証し、現行TaskのDecisionは開始時policyで検証する。
新規Taskの設定欠落に旧方針をfallbackとして使わない。
旧Taskのbytes/hash・checker固定条件は変更しない。新規policyは開始時snapshotと同じ保護境界に属する。

Coreは宣言に基づく必須検証・ownership・証拠の整合を検査する。技術アダプタはpathやprofileを
選ばず、渡された入力から事実を返す。現時点のStorybook detectorは`storybook_tag_text`であり、
source内の指定文字列を保守的に観測する。tag削除とfile削除も変更前後のsourceから拾う。
既存同様コメント中の文字列も対象になり、動的tagやcomponent依存関係の意味は証明しない。
この変更では判定方式を狭めず、検出漏れを生じさせずに所有者を分離する。

pnpmアダプタは依存分類を入力として、保護対象closure・toolchain・設定の変化を返す。
CoreはTask種別による片側保持を要求せず、実際の許可範囲と変更後の検証を確認する。
peer構成の正規化は同じ反対側root更新から一意に導ける場合に限定し、共有依存や参照欠落を
成功に変換しない。技術形式の未対応・不正はエラーにする。
Vitest/Pythonアダプタは指定テストの実行identity・成功と結果採取の入力契約を確認する。
package manager・Python launcherの選択はrepository policyが所有する。Python adapterは起動引数末尾の
`-m unittest -v`を検査し、verbose結果採取を維持する。結果・selector用引数の差し替えは拒否する。

方針変更はpolicyとそのテストへ、技術形式への対応はアダプタとそのテストへ閉じる。
policyの改訂権限は[workflowのLearn契約](workflow.md#review--learn)に従い、改訂後の方針は後続Taskへ適用する。
Coreは各Taskに固定した方針の適用・保護を担い、repository方針自体の改訂可否は決めない。
これは任意式・外部commandを実行する汎用ルールエンジンではない。
変更時は不変条件と許容・拒否条件を明示し、既存の誤検知を含む判定方式の再現自体を目的にしない。
