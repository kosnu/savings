---
title: Book Domain Rules
doc_type: domain
status: accepted
area: repository
applies_to:
  - apps/api/supabase/migrations
  - apps/web/src/types/database.types.ts
topics:
  - domain
  - book
  - ownership
  - authorization
when_to_read:
  - Book所有モデル、default book、book member権限を確認するとき
---

# Book Domain Rules

## Rules

- Bookは支払い、カテゴリ、月次予算の所有境界になる。
- Book membershipはユーザーとBookの所属関係を表す。
- 同じユーザーは同じBookに重複所属できない。
- 認証ユーザーのdefault bookはBook membershipで判定する。
- 新規ユーザーにはdefault bookとmembershipを作成する。
- 認証ユーザーにはdefault bookが存在する前提で扱う。
- Book-owned dataの作成時に所有先Bookが未指定の場合、認証ユーザーのdefault bookを使う。
- Book-owned dataは、対象Bookのmemberだけが参照・作成・更新・削除できる。
- Book-owned dataの所有先Bookは更新時に維持される。
