---
title: User Domain Rules
doc_type: domain
status: accepted
area: repository
applies_to:
  - apps/api/supabase/migrations
  - apps/web/src/types/user.ts
  - apps/web/src/providers/supabase
topics:
  - domain
  - user
  - auth
when_to_read:
  - 認証ユーザー、アプリ内ユーザー、Book membershipの関係を確認するとき
---

# User Domain Rules

## Rules

- アプリ内ユーザーは認証プロバイダーのユーザーと対応する。
- 認証プロバイダーのユーザーIDはアプリ内ユーザーに対して一意である。
- ユーザーのemailは一意である。
- 認証済み操作では、認証中のユーザーに対応するアプリ内ユーザーが存在する前提で扱う。
- 認証中のユーザーに対応するアプリ内ユーザーが見つからない場合はエラーになる。
- ユーザーはBook membershipを通じてBook-owned dataへアクセスする。
- 新規ユーザーにはdefault bookとmembershipを作成する。
