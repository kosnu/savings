---
title: Amount Domain Rules
doc_type: domain
status: accepted
area: repository
applies_to:
  - apps/web/src/domain/amount.ts
  - apps/web/src/features/payments
  - apps/web/src/features/budgets
topics:
  - domain
  - amount
  - validation
when_to_read:
  - 金額入力、保存、表示のルールを確認するとき
---

# Amount Domain Rules

## Rules

- 金額は整数として扱う。
- 金額は0以上でなければならない。
- 必須金額は空を許容しない。
- 任意金額は空入力を未入力として扱える。
- 文字列入力はtrimしてから数値化する。
- 小数表現や負数表現は最終的に不正な金額として扱う。
