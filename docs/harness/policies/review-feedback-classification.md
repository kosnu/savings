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
  - レビュー指摘の局所修正とAuditでの改善提案を分けるとき
---

# Review Feedback Classification

指摘の妥当性を実際の差分と関連規則で判断し、症状と原因を分ける。
症状は局所defect、要求不足、設計問題、配信不具合など。原因は局所的な誤り、再利用できる
ガードレールの問題、未確定を区別する。policy不足、routing、読込・適用、機械検出漏れを
必要な証拠で調べ、推測だけで恒久的な制約を増やさない。

- 現在のIntentと権限内のdefectは、同じTaskで修正・再検証する。
- 意図・完了条件・権限を変える判断はユーザーへ確認し、出典を新しいdecision revisionに残す。
- 再利用可能な改善案は[Audit](learning-extraction.md)へ記録し、手動承認後に対象範囲だけを改善する。
- 原因未確定は不足する証拠を示す。分類自体をTask分割や、許可済み修正の中断理由にしない。

threadごとの解決状態を確認し、解決済みを未解決として報告しない。
局所defectの修正とその過程から得た改善案は区別する。ガードレール検証の成功はproduct修正の代替ではない。
対応済みの証拠と返信権限がある場合だけ返信し、未完了threadをresolveしない。
[Git Workflow](git-workflow.md)と[AIDD v4](../../ai-driven-development/workflow.md)を適用する。
