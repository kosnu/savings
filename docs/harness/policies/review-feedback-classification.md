---
title: Review Feedback Classification
doc_type: policy
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
topics:
  - review
  - pull-request
  - ai-driven-development
  - requirements
  - design
  - verification
when_to_read:
  - PRレビューコメントに対応するとき
  - 未解決review threadを確認するとき
  - レビューコメントをShip、学びの抽出、Build / Verify工程内の整合性問題に分類するとき
---

# Review Feedback Classification

指摘への対応を選ぶ前に、妥当性と原因を評価します。次の2軸を分けて記録し、
local defectと分類した時点で原因評価を打ち切ってはいけません。

- 症状・修正対象: local defect、requirement gap、design issue、delivery defectなど。
- 原因・再利用性: 今回だけの局所的な誤りか、再利用可能なguardrail failureか。

原因評価では、関係するpolicyの不足、rule-mapの選択・routing・依存closure、
agentによる読込・適用、checkerで機械検出可能な違反の検出漏れ、agent guidanceの不足を、
区別に必要なrepository evidenceで確認します。既存policyがあることや、修正が小さいことだけで
制御不全を否定しません。一方、Agentの適用漏れを仮定しただけでは制御不全を確定せず、原因未確定を追加制約の必要性へ読み替えません。追加変更の採否はLearning Extractionの原因調査・対策選定に従い、既存責務を維持する判断も記録します。

| 原因評価の結果                                                 | 対応                                                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| purely local defect（再利用可能な制御不全なしと確認）          | 同じPRの修正は完了表示にかかわらず同じTaskで修正・再検証する。別の新規作業はIntentの出典・実行許可と新しい作業境界を確認して開始する |
| reusable / guardrail failure（症状がlocal defectの場合を含む） | 許可されたguardrail改善を同じTaskのDecisionへ記録し、product修正とそれぞれ必要な検証を行う                                           |
| 原因未確定                                                     | 不足する根拠・判断を明示し、原因と再利用性を評価してから対応を確定する                                                               |

requirement gapは人間の意図・受け入れ条件を確認し、補足・訂正の出典を同じTaskの新checkpointへ記録します。
Issueを使う場合は許可された内容を既存Issueにも反映します。Issueなしではユーザーの明示発言を保持します。
同じ成果への修正か独立した新規作業か、実行許可の追加が必要かはworkflowの境界で判断します。
再利用可能な制御不全がない場合、design issueは同じ意図と権限内でdecisionを改訂して再検証し、
delivery defectは許可されたShip範囲で対応します。症状の分類にかかわらず制御不全がある場合は
許可された改善を現在のTaskで扱います。原因の分類だけをTask分割やDevelopment中断の理由にしません。
追加配信と新規作業の判定は[workflowの継続境界](../../ai-driven-development/workflow.md#追加配信とtaskの継続)に従います。
取り込んだルールの採用は[guardrailの契約](../../ai-driven-development/workflow.md#rule--ownership--guardrail)に従い、既存Taskを保持して新checkpointで再検証します。

例えばcomponent配置違反では、移動による局所修正とは別に、policyの不足、routingによる未適用、
検出可能な違反のchecker検出漏れ、guidanceの不足を評価します。制御不全が確認された場合は
component移動だけを完了根拠にしません。一方、再利用できる知見がない単純なtypoは無理にguardrail化しません。

Learnは `learning-extraction.md` の入力ゲート・原因調査に従います。
resolved review threadのコメントを自動的に新findingへ戻しません。
guardrailの検証成功をproductの修正完了とは扱いません。既に許可されたproduct実装は同じTaskで継続します。

意図、許可範囲、成功条件、riskを変更する判断が必要なら、その根拠と不足する判断を示します。
原因評価でpurely localと確認した既存decision内の整合性修正は自律的に実施し、検証証拠を更新します。
対応済みの根拠と明示的な返信許可がある場合だけ返信し、未完了事項があるthreadをresolveしません。
