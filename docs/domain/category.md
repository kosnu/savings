---
title: Category Domain Rules
doc_type: domain
status: accepted
area: repository
applies_to:
  - apps/api/supabase/migrations
  - apps/web/src/features/categories
  - apps/web/src/types/category.ts
topics:
  - domain
  - category
  - book-owned-data
when_to_read:
  - カテゴリ作成、更新、削除、支払いとの関係を確認するとき
---

# Category Domain Rules

## Rules

- カテゴリはBookに属する。
- カテゴリ名は同一Book内で一意である。
- カテゴリ名は空白のみを許容しない。
- カテゴリ名は20文字以内である。
- カテゴリ作成時に所有先Bookが未指定の場合、認証ユーザーのdefault bookを使う。
- カテゴリの所有先Bookは更新で変更できない。
- カテゴリ更新時は更新日時を更新する。
- カテゴリ削除時、関連する支払いはカテゴリ未設定になる。
- カテゴリ削除時、関連するピン留めは削除される。
- 支払いに設定するカテゴリは、支払いと同じBookに属していなければならない。
- カテゴリが未設定の支払いは「未分類」として扱う。
- カテゴリのピン留め状態はカテゴリ本体ではなくカテゴリ表示設定として扱う。
- 1ユーザーは同じカテゴリを重複してピン留めできない。
- ピン留めできるカテゴリは、認証ユーザーが所属するBookのカテゴリに限る。
- カテゴリ作成と同時にピン状態を保存する場合は、同一操作単位として扱う。
- カテゴリ名更新とピン状態更新を同時に保存する場合は、同一操作単位として扱う。
- ピン登録数の上限は3件である。
