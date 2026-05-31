---
title: Date Domain Rules
doc_type: domain
status: accepted
area: repository
applies_to:
  - apps/web/src/domain/date.ts
  - apps/web/src/features/payments
  - apps/web/src/features/budgets
  - apps/web/src/features/summaryByMonth
topics:
  - domain
  - date
  - month
when_to_read:
  - date-only文字列、対象月、月次集計の期間ルールを確認するとき
---

# Date Domain Rules

## Rules

- 日付だけを表す文字列は年月日形式で扱う。
- 日付だけを表す文字列はローカル日付として扱う。
- 対象月は年と月の組み合わせで表す。
- 月初日は対象日の年・月の1日として扱う。
- 月末日は対象日の月末日として扱う。
- 月次予算の有効開始日は対象月の月初日として保存する。
