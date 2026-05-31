---
title: Payment Domain Rules
doc_type: domain
status: accepted
area: repository
applies_to:
  - apps/api/supabase/migrations
  - apps/web/src/features/payments
  - apps/web/src/types/payment.ts
topics:
  - domain
  - payment
  - expenditure
when_to_read:
  - 支払いの作成、更新、削除、カテゴリ、月次集計を確認するとき
---

# Payment Domain Rules

## 支払い

- 支払いはBookに属する。
- 支払いには日付と金額が必須である。
- 支払い金額は金額ドメインのルールに従う。
- 支払いメモは任意で、30文字以内である。
- 空の支払いメモは未入力として扱う。
- 支払いカテゴリは任意である。
- カテゴリ未設定の支払いはカテゴリなしとして扱う。
- 支払いに設定するカテゴリは支払いと同じBookに属していなければならない。
- 支払い作成時に所有先Bookが未指定の場合、認証ユーザーのdefault bookを使う。
- 支払いの所有先Bookは更新で変更できない。

## 月次支出合計

- 月次支出合計は、認証ユーザーが所属するBookの支払いだけを対象にする。
- 月次支出合計は対象月の1日以上、翌月1日未満の支払いを合計する。
- 月次支出合計は該当支払いがない場合0を返す。
- 月次カテゴリ別支出合計はカテゴリごとの支払い金額合計を表す。
- カテゴリ未設定の支払いは「未分類」の月次支出合計として扱う。
