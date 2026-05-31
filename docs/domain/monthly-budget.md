---
title: Monthly Budget Domain Rules
doc_type: domain
status: accepted
area: repository
applies_to:
  - apps/api/supabase/migrations
  - apps/web/src/features/budgets
topics:
  - domain
  - monthly-budget
  - budget
when_to_read:
  - 月次予算の作成、更新、有効月、使用状況を確認するとき
---

# Monthly Budget Domain Rules

## Rules

- 月次予算はBookに属する。
- 月次予算は対象月の月初日を有効開始日として保存する。
- 月次予算の対象年と対象月は有効開始日から決まる。
- 同一Book・同一年・同月の月次予算は重複できない。
- 作成時に所有先Bookが未指定の場合、認証ユーザーのdefault bookを使う。
- 月次予算の所有先Bookは更新で変更できない。
- 有効な月次予算は、対象月末日以前に開始した予算のうち最新の1件である。
- 月次予算の金額は金額ドメインのルールに従う。
- 月次支出合計は、対象月の支払い合計として扱う。
- 予算使用状況は月次予算額から月次支出合計を差し引いて計算する。
- 差分が0以上なら残額、負なら超過額として扱う。
