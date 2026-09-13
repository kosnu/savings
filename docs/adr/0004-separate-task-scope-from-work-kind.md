---
title: Separate Task scope from work kind
doc_type: adr
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
  - docs/harness
  - .agents
topics:
  - ai-driven-development
  - task-scope
  - verification
when_to_read:
  - Taskの継続とPRの検証境界を判断するとき
---

# ADR-0004: 作業種別とTask・PRの境界を分離する

## Context

ルール保守を独立Learnへ強制しながら1 PRを1 Taskに制限すると、同じブランチで実装と保守を
進める正当な依頼が停止する。ルール採用だけの例外ではLearn記録の所有・CI検査との衝突が残る。
ユーザーは2026-09-14に、独立Learnの強制と1 PR・1 Task制約の撤廃を明示した。

## Decision

ADR-0003のDevelopment / Learn間の変更隔離と1 PR・1 Taskの決定を置き換える。

- Taskは許可された目的と担当範囲を記録する。実装とルール保守は同じTaskで継続できる。
- 作業の種類を理由にTask・Goal・ブランチ・PRを分割しない。単独の新規依頼はTaskを開始できる。
- 新checkpointは現在のrule-mapを保存し、各時点の索引で必須ルールを解決する。
  ルール変更の先行commitや専用の採用例外は設けない。
- PRのTask数を制限しない。変更された全Taskの証拠を検査し、その担当差分の和集合でPRを検証する。
- Task生成記録は各Taskの履歴として検査する。他Taskの成果物ownershipへ追加させず、
  生成記録の追記だけで相互に証拠を失効させない。
- ユーザーの明示制限、所有成果物、開始時実行policy/profile、checker移行と最終ソースの検証は維持する。
  Task開始前の未検証差分を新Taskで隠すことは許可しない。

## Consequences

作業種別から変更可否を導く検査と、Task件数によるCI拒否を撤廃する。
既存Task・checkpoint・証拠の履歴は保持し、対応checkerへの移行後に継続できる。
複数Taskの検証結果は最終ソースへ結合するため、ソース変更後は関係するTaskを再検証する。
Taskの追加自体や、ルール保守のための別Task作成は必須ではない。
