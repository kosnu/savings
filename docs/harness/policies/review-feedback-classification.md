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
制御不全を否定しません。根拠が不足する場合は原因未確定として残し、今回の修正だけで閉じません。

| 原因評価の結果 | 対応 |
| --- | --- |
| purely local defect（再利用可能な制御不全なしと確認） | 同じDevelopment / Decision内で修正・再検証する。完了済みtaskなら既存Issueから新Developmentを開始する |
| reusable / guardrail failure（症状がlocal defectの場合を含む） | 今回のproduct修正だけで閉じず、独立Learnへ渡す。guardrailの更新・検証・確定でLearnを終了し、必要なら既存Issueから新Developmentへ渡す |
| 原因未確定 | 不足する根拠・判断を明示し、原因と再利用性を評価してから対応を確定する |

requirement gapは人間の意図・受け入れ条件を確認し、必要な変更を既存Issueへ明示反映します。
再利用可能な制御不全がない場合、design issueは同じ意図と権限内でdecisionを改訂して再検証し、
delivery defectは許可されたShip範囲で対応します。症状の分類にかかわらず制御不全がある場合は
独立Learnへの分岐を優先し、guardrail変更に依存するDevelopmentを中断します。

例えばcomponent配置違反では、移動による局所修正とは別に、policyの不足、routingによる未適用、
検出可能な違反のchecker検出漏れ、guidanceの不足を評価します。制御不全が確認された場合は
component移動だけを完了根拠にしません。一方、再利用できる知見がない単純なtypoは無理にguardrail化しません。

Learnは `learning-extraction.md` の入力ゲート・原因調査に従います。
resolved review threadのコメントを自動的に新findingへ戻しません。
Learnでguardrailを確定してもproductの修正完了とは扱わず、product実装を連続して開始しません。

意図、許可範囲、成功条件、riskを変更する判断が必要なら、その根拠と不足する判断を示します。
原因評価でpurely localと確認した既存decision内の整合性修正は自律的に実施し、検証証拠を更新します。
対応済みの根拠と明示的な返信許可がある場合だけ返信し、未完了事項があるthreadをresolveしません。
