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

Issueは人間のintentの正本。Task contractはagentのobjective、constraints、Done、verification、
deliveryを持つ。Decisionは要求の解釈、採用判断、観測可能なbehavior、ownership、representation、
verification caseを持つ。repositoryが実際の結果、証拠がその検証記録である。
Issueに実装ファイルやrule-mapの語句を記載する必要はない。

要求の根拠をintent、guardrail、derivedに分ける。intent根拠はsnapshot本文に実在する必要がある。
既存コードは実装文脈であり人間の意図を追加しない。意図、受け入れ条件、権限の変更は明示的に
既存Issueへ反映してから別taskを開始する。技術的な設計選択は委任範囲内でagentが決める。

## Development

1. Issue本文と出典を取得し、task-startでTaskとGit baselineを固定する。
2. repositoryとrule-mapを探索し、要求・設計・検証方針を同じDecision draftで反復する。
3. checkpointで実装が参照する判断を固定する。常時の人間承認gateにはしない。
4. ownership内で実装し、実差分と最終inventoryを照合して検証・reviewする。
5. 依頼されたdelivery範囲でShipする。local検証、PR提出、merge、deployを混同しない。

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

## Rule / ownership / guardrail

baseline内のowned pathsと最終representationから必要ruleを導出し、実差分でも照合する。
削除対象pathもroutingする。surface必須rule、path一致rule、depends_on closureをすべて適用する。
priorityは適用除外に使わない。topics/domains/activities/front matterは探索用である。
最終inventoryに不足または未登録pathがあれば失敗する。ownershipは書込権限を拡張しない。

Development中のguardrailはread-only。protocol policy、rule-map、profile catalog、rule文書、
checker・adapter等の保護対象を開始時に固定する。新しいpathも開始時policyで分類する。
実装を成立させるためにruleを緩和したり、改訂で保護を解除してはいけない。
guardrail変更が必要ならDevelopmentを中断し、独立したLearnへ渡す。

混在JSON設定は開始時policyのproduct_fields（JSON Pointer）だけをDevelopmentで変更でき、
guard_fieldsはそのsubtree内でも優先保護する。Learnは逆にproduct fieldを保持する。
ファイルの追加・削除・mode変更、未宣言fieldはproduct変更へ読み替えない。
packageの検証script・tool依存を保護し、build/dev scriptとproduct依存を区別する。
Vite設定は独立したvitest.configから参照されていないproduct build設定として扱う。
pnpm lockfile v9はimporterと解決済みpackage/snapshotの推移依存を照合する。Developmentは
検証toolの解決実体・lockfile共通設定を保持し、Learnはproductの解決実体を保持する。
packageのpeer宣言があり、相手側rootとpeer構成を含む解決versionが一致する参照だけを相手側で検査する。両方が共有する推移依存の実体変更は
一方だけの変更として通さない。未知の形式・参照欠落は失敗させる。
local/file依存の実体検査は未対応で、保護対象closureに含む場合は拒否する。
新しいtoolの分類はpolicy判断であり、依存名から意味を推測して保護を解除しない。

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
確定根拠にしない。独立reviewの確認者・具体的な観察・確定許可を最新証拠に結び付けて記録する。
reviewをテスト成功から生成してはいけない。Learn終了後にproduct実装を自動開始しない。

## 再開・委譲

repositoryのTask、最新checkpoint、証拠を共通入力とする。会話履歴やGoal本文は正本ではない。
専用worktreeは単一writerが所有する。read-only調査は並列化できる。並行実装は別worktreeを使い、
統合後の最終状態を所有agentが再検証する。subagentは明示されたscopeを超えず、Goalの管理は親が行う。

## 旧protocol

新規実行はschema v5のみ。v2/v3/v4のRequirements/Designと既存receiptは履歴であり、
v5 checkpoint/evidenceへ昇格しない。公開CLIに旧phase実行経路はない。
過去artifactの読取・表示同期検査と、保存する保証の回帰testは維持する。
移行中taskを新旧混在のまま再開しない。旧taskを保存して新しいv5 taskとして再開する。
