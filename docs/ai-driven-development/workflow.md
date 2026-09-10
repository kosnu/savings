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

GitHub Issueを指定した実行依頼はDevelopmentへ入る。Issue番号の参照だけ、read-onlyな質問、
説明、調査、設計案の依頼では開始しない。Issueがないproduct実行依頼は既存Issueの特定を求める。
Task開始前に専用worktreeとbranchを用意し、cleanな基準点を固定する。無関係な変更は移さない。
開始時checkerは[operations](aidd-checker-operations.md)の準備commandで自動取得する。
同じソース・連動契約・実行環境なら検査済みbinaryを再利用し、Task期間中は返されたpathを保持する。

Issueは人間のintentの正本。Task contractはagentのobjective、constraints、Done、verification、
deliveryを持つ。Decisionは要求の解釈、採用判断、観測可能なbehavior、ownership、representation、
verification caseを持つ。repositoryが実際の結果、証拠がその検証記録である。
Issueに実装ファイルやrule-mapの語句を記載する必要はない。
Taskのdelivery=localはローカル完了までとし、ship-check/ci-checkのPR配信境界ではdelivery=prを要求する。
後からstage/commitした事実を配信範囲の拡大許可として扱わない。
Developmentの実行依頼は、必要な検証・review、commit、push、PR作成または更新と配信状態の確認までを含む。
開始時のdeliveryはprとし、完了地点の指定がないことを理由にlocalへ縮小したり、追加のShip許可を求めたりしない。
ユーザーが明示的にShipを制限した場合だけ、その制限を既存のconstraintsとDoneへ反映する。
PR配信を禁止されたTaskにはlocalを使う。agentが生成したlocal指定はユーザーの制限の根拠にならない。
Issueの明示的な制限と実行依頼が矛盾する場合は、最新の明示指示で解消できなければ確認する。

要求の根拠をintent、guardrail、derivedに分ける。intent根拠はsnapshot本文に実在する必要がある。
既存コードは実装文脈であり人間の意図を追加しない。意図、受け入れ条件、権限の変更は明示的に
既存Issueへ反映し、新しい作業の境界を確定してから別taskを開始する。既存成果の追加配信は
下記の継続境界に従い、この規定をTask再作成の根拠にしない。技術的な設計選択は委任範囲内でagentが決める。

## 自律判断と確認の境界

委任された意図・受け入れ条件・制約・権限内では、repositoryの根拠とguardrailを使って
技術選択、設計の具体化、必要な検証と修正を進める。技術詳細の未記載、複数の実装案、
技術構成の変更や新規依存の必要性だけを停止理由にしない。既存仕様の変更が依頼の目的である場合は、
その変更自体を矛盾と扱わず、維持すべき仕様・互換性・guardrailとの整合を確認する。
重要な採用判断と根拠はDecisionへ記録し、通常の技術判断ごとに承認を求めない。

次の場合は、不足する判断と成果への影響を示し、依存する作業の前に確認する。

- 意図・受け入れ条件の解釈によってユーザーに届く成果が変わり、根拠から選べない。
- スコープ、制約、権限、完了地点の変更、または個別に事前確認が指定された操作が必要。
- guardrailとの矛盾が解消できない。guardrail更新は独立Learnへ渡す。

確認待ちでも、回答に依存しない許可済みの調査・検証は進めてよい。回答がないことを許可と扱わない。
必須検証が失敗した場合は原因を調べ、今回の範囲で修正できるものは修正して再検証する。
範囲外の修正が必要な失敗は根拠と阻害範囲を報告し、無関係な修正や成功扱いで迂回しない。
既存Issueの自律範囲やStop条件も個別制限として尊重し、この既定動作で解除しない。

## Development

1. Issue本文と出典を取得し、task-startでTaskとGit baselineを固定する。
2. repositoryとrule-mapを探索し、要求・設計・検証方針を同じDecision draftで反復する。
3. checkpointで実装が参照する判断を固定する。常時の人間承認gateにはしない。
4. ownership内で実装し、実差分と最終inventoryを照合して検証・reviewする。
5. 検証済みの変更をcommit・pushし、PR作成または更新と配信状態の確認までShipする。
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
HEADは元baselineの子孫でなければならず、実差分はcommitをまたいで元baselineから照合する。
初期vNextは1 PR全体を1 taskの検証境界とする。基準点はPR merge-baseと一致させる。
review後は同じTaskで必要なcheckpoint改訂・全差分の再検証を行う。Task baselineを取り直さない。
既存branchや変更を自動破棄しない。

### 追加配信とTaskの継続

この境界はDevelopmentとLearnの両方に適用する。既存成果への追加Ship依頼では、まず既存Task、
baseline、delivery、対象PRとbaseを確認する。`delivery=pr`で同じPRへ配信する場合は、検証・commitや
Goalの完了後でも同じTaskを継続し、必要なcheckpoint改訂と元baselineからの全差分検証を行う。
この継続経路では追加の契約変更や新しい配信許可を要求しない。
追加の「ship」依頼は既存成果の配信許可であり、Task、基準点、PRの分割・変更まで許可したとは扱わない。

配信検査が失敗した場合は元Taskと失敗根拠を保持し、同じ境界内で修正する。Taskの再作成や別PRへの
成果物の移し替えによって、元Taskの制約、開始時checker、baseline以前の差分を検査対象から外してはいけない。
技術的に前提修正PRが必要でも、その必要性をユーザーの許可文へ加えず、変更前後のTask・PR・baseと
持ち出す成果物、既存Taskの扱いを具体化して境界変更を確認する。明示許可を得てもCoreの検査は免除しない。

`delivery=local`への正当な追加配信依頼は、配信権限の変更として扱う。現行v5には既存Taskのdeliveryを
変更する操作がないため、Taskを書き換えたり`delivery=pr`の別Taskを作ったりせず、元記録を保持して未対応の契約変更を
報告する。必要な対応は独立Learnへ渡す。許可の追加だけで技術的な未対応を解消したことにしない。
別の新規作業や、明示的に承認された配信境界の再設計は、既存Taskを保持したうえでcleanな基準点から
開始する。既存PR全体を新Taskで覆い直すことや、既存検査の失敗を消すことはこの経路に含めない。
この運用境界の明記だけで、別PR間のTask置換を機械的に検出できるとは扱わない。
現在の検査範囲と受入確認は[operations](aidd-checker-operations.md#ship--ci)に従う。

## Rule / ownership / guardrail

baseline内のowned pathsと最終representationから必要ruleを導出し、実差分でも照合する。
削除対象pathもroutingする。surface必須rule、path一致rule、depends_on closureをすべて適用する。
priorityは適用除外に使わない。topics/domains/activities/front matterは探索用である。
最終inventoryに不足または未登録pathがあれば失敗する。ownershipは書込権限を拡張しない。

Development中のguardrailはread-only。protocol policy、rule-map、profile catalog、rule文書、
checker・adapter等の保護対象を開始時に固定する。新しいpathも開始時policyで分類する。
実装を成立させるためにruleを緩和したり、改訂で保護を解除してはいけない。
guardrail変更が必要ならDevelopmentを中断し、独立したLearnへ渡す。

同じ設定や依存関係にproductとguardrailが混在する場合も、各Taskで保護する対象を保持する。
形式ごとの変更許可と検査境界は[checkerの設定・依存関係の保護](aidd-checker.md#設定依存関係の保護)に従う。

## Review / Learn

feedbackは対応前に妥当性と原因を評価し、症状・修正対象と、原因・再利用性を別軸で扱う。
local defectという分類で原因評価を終えない。policy不足、routing・読込・適用の不全、
機械検出可能な違反の検出漏れ、guidance不足をrepository evidenceで区別する。
purely localと確認できたdefectは同じDevelopment / Decision内で修正・再検証する。
再利用可能なguardrail failureならproduct修正だけで閉じず独立Learnへ渡し、
guardrail更新・検証・確定でLearnを終了する。必要なproduct実装は既存Issueから新Developmentへ渡す。
原因未確定は不足根拠を明示する。単純なtypoを無理に恒久ruleにしない。
requirement gap・design issue・delivery defectも同じ原因軸を評価する。
詳細な判断境界は[review feedback policy](../harness/policies/review-feedback-classification.md)を適用する。

LearnはIssue不要の独立task。入力・原因調査は[learning policy](../harness/policies/learning-extraction.md)に従う。
分析だけの依頼は書込許可ではない。変更が許可された場合はauthorizationと有限scopeを固定し、
guardrail文書、routing、checker、adapter、検証機構を変更・検証できる。
product pathの変更は禁止する。開始時checker binaryと旧profileで検証し、変更後checkerの成功だけを
確定根拠にしない。担当agent自身が最新差分と証拠をreviewし、依頼された許可範囲で確定する。
独立reviewや別agentの呼び出しは必須にせず、ユーザーが明示的に依頼した場合だけ行う。
reviewをテスト成功から生成してはいけない。
base checkerとの非互換な契約変更をCIへ配信するときだけ、
[契約移行経路](aidd-checker-operations.md#非互換なchecker契約の移行)で差分検査・候補検証・
対象commitへの人の承認を必要とする。通常Learnのreview要件や元Taskの継続境界は変更しない。
Learn終了後にproduct実装を自動開始しない。

## 再開・委譲

repositoryのTask、最新checkpoint、証拠を共通入力とする。会話履歴やGoal本文は正本ではない。
専用worktreeは単一writerが所有する。subagent利用はAGENTS.mdの費用対効果条件に従う。
委譲する場合、並行実装は別worktreeを使い、
統合後の最終状態を所有agentが再検証する。subagentは明示されたscopeを超えず、Goalの管理は親が行う。

## 旧protocol

新規実行はschema v5のみ。v2/v3/v4のRequirements/Designと既存receiptは履歴であり、
v5 checkpoint/evidenceへ昇格しない。公開CLIに旧phase実行経路はない。
過去artifactの読取・表示同期検査と、保存する保証の回帰testは維持する。
移行中taskを新旧混在のまま再開しない。旧taskを保存して新しいv5 taskとして再開する。
