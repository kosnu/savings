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

Coreは`tools/aidd/checker/internal/protocol`。schema v5のTask、Decision、checkpoint、evidenceを
検査し、phase順序、Goal lifecycle、model、executor、agentのStop判断を制御しない。
Codex Hookは`internal/adapters/codex/hooks`に置き、Coreから参照しない。

## 保存する保証

既存のsemantic target検証、catalog、rules、repository snapshot、state、runner、evidenceを共有する。
要求→behavior→verification→representationの参照、finite ownership、最終inventory、path/surface
closure、profile-fixed argv、test selectorの実行identity、stream/output hashを検証する。
manual観察の形式検査を意味的正しさの証明とは扱わない。

Task開始時の全non-ignored file inventory、Git HEAD、policy、rule-map、profile bytes、
checker executable hashを固定する。開始にはcleanな専用worktreeを要求する。
Taskとcheckpointはmode 0600のcanonical JSONとしてatomic writeし、既存recordを上書きしない。
raw policy/profile bytesはbase64で保持し、serializationによるhash変化を防ぐ。

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

## Learnの信頼境界

Learnも開始時binaryを使う。candidate checkerへの置換をhashで拒否し、旧profileと旧policyを
Taskのbytesから解決する。product pathsと許可scopeは旧policyで検査する。
混在package設定とlockfileは[設定・依存関係の保護](#設定依存関係の保護)に従い、tool更新の同期を許可する。
新checkerのtest成功だけではLearnを確定せず、担当agent自身が最新差分とevidenceをreviewする。
Learnのfinish/Ship/CIは独立review記録を要求しない。別agentはユーザーの明示依頼時だけ呼ぶ。
reviewの意味と許可範囲は担当agentが確認する。JSONやhashは署名ではない。

## 設定・依存関係の保護

混在JSON設定は開始時policyのproduct_fields（JSON Pointer）だけをDevelopmentで変更でき、
guard_fieldsはそのsubtree内でも優先保護する。Learnは逆にproduct fieldを保持する。
ファイルの追加・削除・mode変更、未宣言fieldはproduct変更へ読み替えない。
packageの検証script・tool依存を保護し、build/dev scriptとproduct依存を区別する。
Vite設定は独立したvitest.configから参照されていないproduct build設定として扱う。
pnpm lockfile v9はimporterと解決済みpackage/snapshotの推移依存を照合する。Developmentは
検証toolの解決実体・lockfile共通設定を保持し、Learnはproductの解決実体を保持する。
packageのpeer宣言があり、相手側rootとpeer構成を含む解決versionが一致する参照だけを相手側で検査する。両方が共有する推移依存の実体変更は
一方だけの変更として通さない。保護対象root・依存edge・snapshotのidentityはpeer構成を含めて保持し、
同じpackage/versionのvariantを親やimporter間で入れ替えても同一扱いしない。
同じimporter/section/nameの反対側root更新に一意に対応するpeer構成の変更だけを許可する。
この対応は保護対象のpackage自身のversionや通常共有依存を変更する許可ではない。対応が分岐・削除されるpeer参照の改名や、
異なる依存内容へのsnapshot衝突は失敗させる。未知の形式・参照欠落は失敗させる。
local/file依存の実体検査は未対応で、保護対象closureに含む場合は拒否する。
新しいtoolの分類はpolicy判断であり、依存名から意味を推測して保護を解除しない。

## 運用前提と限界

専用worktree・単一writer、信頼された開始時checker/Git/OS、明示的に許可された操作を前提とする。
同一worktreeへの外部並行writer、直接の.git改変、binary置換を攻撃的に隠すOS操作は防御対象外。
checkerが自己申告された意味を証明したり、暗号署名なしで証拠作成者を認証したりはしない。
agentは解釈、戦略、設計、reviewを担い、checkerは決定論的な整合を検査する。

初期版はclean start、1 PR=1 task、全失効、逐次verificationを採用する。
1 Task内の複数commit・PR review後の再開は対応し、元baselineを維持して全差分を再検証する。
共有worktreeへの並行writer、部分証拠再利用、複数taskのPR合成は未対応。
これは既存保証の維持を優先した境界であり、黙って成功扱いへ緩和しない。

## 実装責務

- protocol: v5 task / decision / checkpoint / verification / delivery。
- semantic / state / rules: targetとownership、rule graph、最終状態。
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
