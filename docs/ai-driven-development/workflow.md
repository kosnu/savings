---
title: AI Driven Development Workflow
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

# AIDD Development / Learn contract

## 入口と権限

ClaudeとCodexは共通のTask / Decision / Checkpoint / Evidence契約を直接実行する。
入口はAGENTS.md、実行フローと権限の正本はこの文書、CLI操作は[operations](aidd-checker-operations.md)に置く。
プロトコルの適用は、実行用skillの存在や発火、Goal機能に依存しない。
CodexでGoal機能を使う場合は[Codex adapter](codex-adapter.md)を追加適用する。

人間のIntentに基づく開発の実行依頼は、Issueの有無によらずDevelopmentへ入る。Issue番号の参照だけ、
read-onlyな質問、説明、調査、設計案の依頼では開始しない。Issueなしの場合はユーザーの明示発言を出典として保持する。
Task開始前に単一writerのworktreeでcleanな基準点を固定する。無関係な変更は移さない。
ブランチの作成・切り替え・分割は[Git Workflow](../harness/policies/git-workflow.md#ブランチ)に従う。
Development / Learnは同じTask内の作業内容の区別であり、それだけでブランチ・PRを分けない。
開始時checkerは[operations](aidd-checker-operations.md)の準備commandで自動取得する。
同じソース・連動契約・実行環境なら検査済みbinaryを再利用し、Task期間中は返されたpathを保持する。

人間のIntentは達成したい結果と制約であり、Issueはその表現・保存方法の一つである。
Issue本文またはユーザーの明示発言を出典本文・参照・hashとして記録する。Task contractはagentのobjective、constraints、Done、verificationを持つ。
Decisionは要求の解釈、採用判断、観測可能なbehavior、ownership、representation、
verification caseを持つ。repositoryが実際の結果、証拠がその検証記録である。
Issueに実装ファイルやrule-mapの語句を記載する必要はない。
この出典契約の採用判断は[ADR-0006](../adr/0006-separate-intent-from-issue.md)に記録する。
Taskにlocal/prの配信区分は設けない。操作範囲はユーザーの明示指示とconstraints・Doneで判断する。
後からstage/commitした事実を配信範囲の拡大許可として扱わない。
Developmentの実行依頼は、必要な検証・review、commit、push、PR作成または更新と配信状態の確認までを含む。
完了地点の指定がないことを理由に検証までへ縮小したり、追加のShip許可を求めたりしない。
ユーザーが明示的にShipを制限した場合だけ、その制限を既存のconstraintsとDoneへ反映する。
agentが生成した配信区分はユーザーの制限の根拠にならない。
Issueの明示的な制限と実行依頼が矛盾する場合は、最新の明示指示で解消できなければ確認する。

要求の根拠をintent、guardrail、derivedに分ける。intent根拠は参照する出典snapshotの本文に実在する必要がある。
既存コードは実装文脈であり人間の意図を追加しない。Task開始時のIntentは固定し、人間による補足・訂正は
同じTaskの新checkpointへ出典付きの`intent_revision`として追記する。要求は出典checkpointを参照する。
Issueを正本として使う作業では、許可された変更をIssue本文にも同期し、取得した本文または補足発言の出典を保持する。
Issueなしでは補足発言そのものを保持し、Issue作成を継続条件にしない。

意図の不足・解釈違いを直す同じ成果への修正は、元Task・baselineを保持してDecisionを改訂する。
同じ意図内の設計変更にはIntentの追記を要求しない。独立した別成果への新規依頼は目的と作業境界を確認して開始する。
Issueの有無、出典変更、Development/Learnの呼称だけをTask分割の理由にしない。
同じ成果への補足・修正は元のIntentに属する。サイクル終了後の新しいIntentは次のTaskを開始する。
Intentの補足は実装許可を自動的に増やさない。既存の実行依頼で委任済みの修正は継続し、目的・権限を広げる場合は
人間の明示許可を別に記録する。質問やLearnの分析だけを実行依頼へ読み替えない。
技術的な設計選択は委任範囲内でagentが決める。出典の真正性と意味的な対応はagentが確認し、Coreは記録の整合を検査する。

## 概念とサイクルの境界

用語の意味と相互関係は[AIDDプロトコル用語集](glossary.md)を正本とする。
一つのTaskが一つのIntentから始まる一つのサイクルに対応する。
対象となる指摘があれば同じTaskでLearnと採用した学びの反映を行い、
指摘がなければLearnを行わずにサイクルを終える。
同じ成果への修正・review対応・追加Ship・Decisionの改訂は元のTaskで続ける。
サイクル終了後の新しいIntentは次のTaskとサイクルを開始する。
工程ごとにTaskやGoalを作らず、Task IDの書式からサイクル境界を推定しない。
保存形式・検査範囲は[compact protocol](compact-protocol.md)と[checker](aidd-checker.md)、Goal操作は[Codex adapter](codex-adapter.md)に従う。

## 自律判断と確認の境界

委任された意図・受け入れ条件・制約・権限内では、repositoryの根拠とguardrailを使って
技術選択、設計の具体化、必要な検証と修正を進める。技術詳細の未記載、複数の実装案、
技術構成の変更や新規依存の必要性だけを停止理由にしない。既存仕様の変更が依頼の目的である場合は、
その変更自体を矛盾と扱わず、維持すべき仕様・互換性・guardrailとの整合を確認する。
重要な採用判断と根拠はDecisionへ記録し、通常の技術判断ごとに承認を求めない。

次の場合は、不足する判断と成果への影響を示し、依存する作業の前に確認する。

- 意図・受け入れ条件の解釈によってユーザーに届く成果が変わり、根拠から選べない。
- スコープ、制約、権限、完了地点の変更、または個別に事前確認が指定された操作が必要。
- ユーザーの指示と適用ルールの矛盾が、既存の許可根拠から解消できない。ルール変更の明示指示があれば、その指示を適用する。

確認待ちでも、回答に依存しない許可済みの調査・検証は進めてよい。回答がないことを許可と扱わない。
必須検証が失敗した場合は原因を調べ、今回の範囲で修正できるものは修正して再検証する。
範囲外の修正が必要な失敗は根拠と阻害範囲を報告し、無関係な修正や成功扱いで迂回しない。
既存Issueの自律範囲やStop条件も個別制限として尊重し、この既定動作で解除しない。

## Development

1. Issue本文またはユーザー発言によるIntentと実行許可を確認し、task-startでTaskとGit baselineを固定する。
2. repositoryとrule-mapを探索し、要求・設計・検証方針を同じDecision draftで反復する。
3. AIDDの仕組みや実行入力の変更では[変更Coverage](change-coverage.md)で概念・representation・全検討軸を評価する。
   checkpointで実装が参照する判断を固定する。常時の人間承認gateにはしない。
4. ownership内で実装し、実差分と最終inventoryを照合して検証・reviewする。
5. 検証済みの変更をcommit・pushし、PR作成または更新と配信状態の確認までShipする。
   CIは[Git WorkflowのCI確認方針](../harness/policies/git-workflow.md#ship時のci確認)に従い、現在の状態を報告して完了を待たない。
   ユーザーの明示制限がある場合だけその範囲に従う。検証完了やCore gate成功だけではDevelopmentを完了しない。
   merge・deployはShipに含めず、個別の実行依頼に従う。

新しい設計判断が必要なら2へ戻る。checkpointはrevision、parent hash、Task hashを持ち、
確定済みrecordを上書きしない。Taskとbaselineは再取得しない。scopeやruleが変わる場合は
次の実装より先に新checkpointを作る。最新revision以外の証拠は使えない。
改訂時は検証証拠を全失効し、変更前の成功結果を部分的にも流用しない。
要求の変更・削除理由はDecisionのreasonに記録し、reviewでintentとの整合を確認する。

Taskのbaseline以前の差分を隠すcommit/rebase/resetは実行中に行わない。
検証batch内では開始時のHEADとstaged treeを不変とし、stageはShip境界で行う。
Task baselineは固定するが、検証・Ship済みcommitの後も同じTask/Goalで継続できる。
HEADは元baselineの子孫でなければならない。統合記録がなければ実差分はcommitをまたいで元baselineから照合する。
PR内のTask数は制限しない。各Taskの担当差分と検証証拠を合わせてPR全体を確認する。
mainを取り込む場合は下記の統合記録を使い、Task開始点と変更判定基準を分ける。
review後は同じTaskで必要なcheckpoint改訂・全差分の再検証を行う。Task baselineを取り直さない。
既存branchや変更を自動破棄しない。

### main取り込み後の検証

Taskの開始点・意図・ユーザーの明示制限・policy/profile・開始時checkerは保持する。
main取り込み後は、Decisionの`integration`へ取り込んだbaseと統合commitを明示して新checkpointを作る。
これはTaskの再作成や権限拡張ではない。Gitの包含関係とCIの現在のtarget baseへの一致を要求する。
履歴から都合のよいmergeを探索して基準点を選ばない。

変更権限・ownership・rule coverage・必須検証は、統合baseと最終状態の差分へ適用する。
main由来の内容と一致するfileはTaskの変更として扱わず、同じpathでも独自の変更・削除・mode変更は検査する。
設定・依存関係の変更も同じ基準から照合し、Task種別を理由に変更を拒否しない。
競合解消結果と統合後の追加変更は最終状態の一部として検査し、過去treeへ巻き戻さない。

checkpoint改訂で旧証拠を全失効させ、統合後の全inventoryに結合した証拠を再生成する。
Task外のmain由来fileも証拠に含め、検証後の変更を検出する。要求・所有成果物の最終状態とreviewにより、
main取り込みで必要な成果を失っていないことを確認する。Gitの差分だけで意味的な達成を証明しない。

baseが進んだら再取り込み・新checkpoint・全再検証を行う。統合base/headの後退や記録の除去は拒否する。
旧checkerが必要な継続機能に対応しないTaskは、許可されたchecker移行をcheckpointへ追記し、移行先で全再検証する。
元Taskを作り直さず、開始記録と旧証跡を保持する。追加修正の許可範囲も移行記録に固定する。
checker実行権限の移行とmain取り込みは別契約であり、[operations](aidd-checker-operations.md#旧taskのchecker移行)に従う。

### 追加配信とTaskの継続

この境界はDevelopmentとLearnの両方に適用する。既存成果への追加Ship依頼では、まず既存Task、
baseline、ユーザーの操作許可、対象PRとbaseを確認する。同じPRへ配信する場合は、検証・commitや
Goalの完了後でも同じTaskを継続し、必要なcheckpoint改訂と全差分検証を行う。統合記録がある場合は上記の変更判定基準を使い、元baselineは保持する。
この継続経路では追加の契約変更や新しい配信許可を要求しない。
追加の「ship」依頼は既存成果の配信許可であり、Task、基準点、PRの分割・変更まで許可したとは扱わない。

配信検査が失敗した場合は元Taskと失敗根拠を保持し、同じ境界内で修正する。Taskの再作成や別PRへの
成果物の移し替えによって、元Taskの制約、開始時checker、baseline以前の差分を検査対象から外してはいけない。
技術的に前提修正PRが必要でも、その必要性をユーザーの許可文へ加えず、変更前後のTask・PR・baseと
持ち出す成果物、既存Taskの扱いを具体化して境界変更を確認する。明示許可を得てもCoreの検査は免除しない。

後から明示されたShip依頼は同じTaskで扱い、配信区分の変更やTaskの再作成を要求しない。
旧Taskのdelivery fieldは履歴として保持し、現行checkerは配信可否の判定に使わない。
開始時checkerの固定と検証証拠の検査は維持する。旧binary自体の挙動は変更されないため、
既存Taskの実行互換性と制約は[operations](aidd-checker-operations.md#ship--ci)に従う。
別の新規作業や、明示的に承認された配信境界の再設計は、既存Taskを保持したうえでcleanな基準点から
開始する。既存PR全体を新Taskで覆い直すことや、既存検査の失敗を消すことはこの経路に含めない。
この運用境界の明記だけで、別PR間のTask置換を機械的に検出できるとは扱わない。
現在の検査範囲と受入確認は[operations](aidd-checker-operations.md#ship--ci)に従う。

## Rule / ownership / guardrail

目的・対象機能・禁止事項・配信先が委任の境界であり、agentが列挙した初期ファイル一覧は作業計画である。
ユーザーが明示したファイル単位の制限は別に保持する。同じ目的に必要で明示制限に反しないテストや
検証profile等は、初期一覧にないことだけを理由に確認・Task分割を求めず、同じTaskで作業範囲へ含める。
目的・影響範囲・配信先が広がる場合や明示制限に反する場合は、変更前にユーザーへ確認する。

現在の作業範囲と成果物は最新Decisionのownershipとrepresentationに記載する。
作業範囲の記録だけでは実装の権限は増えない。product実装はTask種別にかかわらず、Intentの出典と
実行依頼に結び付ける。Development開始時の実行依頼が既にある場合はその記録を使い、再承認しない。
既存の`kind: learn` Task記録にproduct実装の許可を追加する場合は、旧記録を保持したまま
`product_authorization`にIssueまたはユーザー発言の本文・出典・hash、実行許可と有限scopeを記録する。
この互換経路を独立したLearn Taskの新規開始条件として使わない。
許可の真正性とIntentとの意味的な対応はagentが確認し、checkerは記録の必須項目・hash・対象差分との対応を検査する。
DevelopmentはDecisionのownershipを更新する。Learnの作業範囲は初期`authorized_scopes`と
checkpointに記録した`scope_revision.added_scopes`から構成し、追加理由・委任境界のレビュー・確認者を残す。
ユーザーの明示的なファイル制限は`user_scope_limits`へ記録し、作業範囲の追加によって解除しない。
旧Taskでも元の許可文と制約を確認し、明示制限があれば最初の範囲改訂で構造化する。

ownershipは正規化した有限file/treeで宣言する。baseline内のowned pathsと最終representation、
実差分の各pathに一致するsurface必須rule、path固有rule、depends_on closureをすべて適用する。
priorityは適用除外に使わず、topics/domains/activities/front matterは追加探索に使う。
最終inventoryに不足または未登録pathがあれば拒否する。作業計画への登録は書込権限を拡張しない。

Decisionの変更は実装前にcheckpointへ記録し、旧証拠を全失効させる。元Task・baseline・開始時checker・
policy/profileを保持し、更新後の範囲でruleと必須検証を選択して全差分と最終状態を再検証する。
委任内かという意味判断は担当agentの根拠付きレビュー、範囲・明示制限・禁止領域・履歴・証拠の整合は
checkerが担う。操作手順と互換性は[operations](aidd-checker-operations.md#learnの変更対象の改訂)を参照する。

許可されたルール・checker・設定・依存関係の保守は、アプリ実装と同じTaskで行える。
変更理由、許可根拠、対象と検証を通常のDecisionへ記録し、ownership内で修正・再検証する。
AIDD変更の概念・検討対象・実行パターンは[変更Coverage](change-coverage.md)に従って記録し、
Development / Learnの両方でcheckpoint前と最終差分のレビュー時に照合する。
ルール保守を別Learnへ渡すための中断や、先行commit・専用の採用記録は要求しない。
変更後のルールを読み、rule-mapを変えた場合は新checkpointでその索引と必須closureを保存する。
過去checkpointはその時点の索引で解釈し、Task開始記録と過去の証拠は保持する。
機械policy/profileは開始時の実行契約を維持し、checkerの実行互換性が必要な場合は既存の移行経路を使う。

複数Taskが同じブランチにある場合は、各Taskのownershipで差分を分担する。別Taskの生成記録を
アプリの成果物として所有させない。CIは変更された全Taskの最新証拠を検査し、PR基準点からの全差分に
対応する検証を要求する。Taskを選ぶCLI引数で他Taskの差分や未検証成果を隠さない。
検証証拠は全ソースの最終状態へ結合するが、Taskの生成記録は各Taskの履歴として別途検査し、
相手のcheckpointや証拠を書いただけで検証結果を相互失効させない。

## Review / Learn

feedbackは対応前に妥当性と原因を評価し、症状・修正対象と、原因・再利用性を別軸で扱う。
local defectという分類で原因評価を終えない。policy不足、routing・読込・適用の不全、
機械検出可能な違反の検出漏れ、guidance不足をrepository evidenceで区別する。
purely localと確認できたdefectは同じDevelopment / Decision内で修正・再検証する。
再利用可能なguardrail failureなら、許可された改善を同じTaskのDecisionへ記録して修正・検証する。
原因評価と検証の区別を維持し、作業の種類が変わったことだけでTaskを作り直さない。
原因未確定は不足根拠を明示する。単純なtypoを無理に恒久ruleにしない。
requirement gap・design issue・delivery defectも同じ原因軸を評価する。
詳細な判断境界は[review feedback policy](../harness/policies/review-feedback-classification.md)を適用する。

Learnは対象となるfeedbackがある場合に元のIntentから始まったTask内で行う。
feedbackの分析だけを新しいTaskとして開始せず、対象となる指摘がなければLearnは行わない。
入力・原因調査は[learning policy](../harness/policies/learning-extraction.md)に従う。
通常経路から到達可能なfindingは[決定論的検出可否](../harness/policies/learning-extraction.md#決定論的検出可否)を評価する。
許可された改善は、判断根拠と採否をDecisionへ記録し、採用した対策を要求・behavior・検証case・成果物へ接続する。
意味判断の妥当性はagentがreviewし、case参照・実行・Evidenceの整合はCoreが検査する。
記録方法は[Learnの判断と検証の接続](aidd-checker-operations.md#learnの判断と検証の接続)を使う。
分析だけの依頼は書込許可ではない。変更が許可された場合はauthorizationと初期の有限作業範囲を記録し、
guardrail文書、routing、checker、adapter、検証機構を変更・検証できる。
Task種別によるproduct pathの一律禁止は設けず、実際の許可範囲を守る。通常は開始時checker binaryと旧profileで検証する。明示的なchecker移行は移行先binaryを固定し、旧policy/profileを維持する。変更後checkerの成功だけを
確定根拠にしない。担当agent自身が最新差分と証拠をreviewし、依頼された許可範囲で確定する。
独立reviewは必須にしない。別agentへの委譲はAGENTS.mdの費用対効果条件に従う。
reviewをテスト成功から生成してはいけない。
base checkerとの非互換な契約変更をCIへ配信するときだけ、
[契約移行経路](aidd-checker-operations.md#非互換なchecker契約の移行)で差分検査・候補検証・
対象commitへの人の承認を必要とする。通常Learnのreview要件や元Taskの継続境界は変更しない。
分析やルール保守の依頼だけをproduct実装の許可へ広げない。既に許可された実装は同じTaskで継続する。

## 再開・委譲

repositoryのTask、最新checkpoint、証拠を共通入力とする。通常はtask-statusの要約と必要fieldを取得し、巨大な生成JSONの全文読込を要求しない。会話履歴やGoal本文は正本ではない。
専用worktreeは単一writerが所有する。subagent利用はAGENTS.mdの費用対効果条件に従う。
委譲する場合、並行実装は別worktreeを使い、
統合後の最終状態を所有agentが再検証する。subagentは明示されたscopeを超えず、Goalの管理は親が行う。

## 旧protocol

新規実行はschema v6。保存と復元は[compact protocol](compact-protocol.md)、短い入出力は[operations](aidd-checker-operations.md#短い通常操作v6)に従う。既存v5 Taskは同じTask・形式で継続し、bytes/hashを保持する。v2/v3/v4のRequirements/Designと既存receiptは履歴であり、
v5/v6 checkpoint/evidenceへ昇格しない。公開CLIに旧phase実行経路はない。
過去artifactの読取・表示同期検査と、保存する保証の回帰testは維持する。
v2/v3/v4からの再開は旧taskを保存して新しいv6 Taskとして扱う。v5 Taskを軽量化のために作り直してはいけない。
