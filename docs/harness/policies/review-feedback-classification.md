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

指摘は妥当性、現在のintent/decisionとの関係、再利用可能性を確認してから対応します。
local defectであることと再利用可能な原因を持つことは別軸です。

| 分類 | 対応 |
| --- | --- |
| local defect | 同じdecision内で修正・再検証する。完了済みtaskなら既存Issueから新Developmentを開始する |
| requirement gap | 人間の意図・受け入れ条件を確認し、必要な変更を既存Issueへ明示反映する |
| design issue | 同じ意図と権限内でdecisionを改訂し、証拠を失効して再検証する |
| reusable guardrail candidate | 原因調査後に独立Learnへ渡す。今回のproduct修正だけで閉じない |
| delivery defect | PR説明、検証記載、許可された返信等のShip範囲で対応する |

再利用できる知見がなければ、単純なtypoやdefectを無理にguardrail化しません。
Learnは `learning-extraction.md` の入力ゲート・原因調査に従います。
resolved review threadのコメントを自動的に新findingへ戻しません。
Learnでguardrailを確定してもproductの修正完了とは扱わず、新Developmentへhandoffします。

意図、許可範囲、成功条件、riskを変更する判断が必要なら、その根拠と不足する判断を示します。
既存decision内の整合性修正は自律的に実施し、検証証拠を更新します。
対応済みの根拠と明示的な返信許可がある場合だけ返信し、未完了事項があるthreadをresolveしません。
