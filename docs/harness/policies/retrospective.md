---
title: Retrospective
doc_type: policy
status: accepted
area: repository
applies_to:
  - docs/ai-driven-development
  - .agents/skills/retrospective
topics:
  - ai-driven-development
  - retrospective
  - process-improvement
when_to_read:
  - Merge / Close後に作業過程を振り返るとき
  - Retrospectiveの改善提案の引継ぎを判断するとき
---

# Retrospective

Merge / Close後に、終了した作業全体の進め方を振り返り、再利用できる改善候補を整理する。
[AIDD v4](../../ai-driven-development/workflow.md)の通常サイクルとは独立した工程であり、
通常の実行委任、Ship、Audit、サイクル完了の必須条件には含めない。
[Audit](learning-extraction.md)はShip後の指摘と原因の分析を担う。

## 開始と対象

ユーザーがRetrospectiveを明示的に依頼したときに開始する。
対象として指定されたPRのMergeまたはClose、IssueのCloseをGitHubで確認し、
関連するTask・Intent・配信先を特定する。未終了なら開始条件の不足を報告する。
関連PRやIssueに未完了の作業があれば、その状態と振り返る範囲を示し、全体が終了したとは扱わない。
Merge / Closeや通常の開発委任を、自動開始の許可として使わない。

Taskの判断・検証・レビュー、PRの履歴、ユーザーの訂正、会話・ツールの実行記録、
利用可能な工程計測を参照する。文脈取得、規則の読込・適用、ツールの失敗、検証不足、
停止、手戻り、担当の分担などを実際の記録に基づいて確認する。
取得できない会話・計測・原因は不明とし、記憶や推測で補わない。
解決済みの問題は解決済みと明記し、解決までの過程を分析できる。
指摘の局所修正と、作業過程から得た再利用可能な改善案を区別する。

## 成果物と終了

分析結果をユーザーへ提示する。対象PR / Issue・Task、終了状態と確認時点、参照した証拠と不足、
作業過程の観測結果を示す。改善候補ごとに観測事実・出典、影響、原因または原因未確定、
具体案、有限の反映対象、改善後の確認方法を示す。
方針不足、索引の到達性、読込・適用漏れ、検出漏れ、局所的な誤りを区別し、
推測した原因から禁止事項を増やさない。

結果の提示でRetrospectiveを終了する。改善不要ならその根拠を報告する。
提案の承認待ち・保留・却下は改善完了と区別するが、Retrospectiveの終了を妨げない。
報告の保存やIssue作成はユーザーが依頼した場合に行い、所定の作成・承認ルールに従う。
過去のAudit・Task・判断・検証記録は変更せず、通常サイクルへの追加eventや`return-intent`を要求しない。

## 改善提案の引継ぎ

Retrospectiveの依頼や元の開発権限を、改善の適用許可として使わない。
具体的な提案・反映対象・確認方法への明示承認を受けた範囲だけを実施する。
承認された提案とその証拠、承認発言を新しいIntentの出典として保持し、
新しいTaskで設計・実装・検証・レビュー・Shipへ進める。終了したTaskとPRは参照元として保持する。
元のTaskのAudit承認を転用したり、Merge済みPRへ改善を追加したりしない。
提案や対象が変われば旧承認を流用せず、変更した範囲の判断を受ける。
