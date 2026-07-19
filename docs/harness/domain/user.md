---
title: User Domain Rules
doc_type: domain
status: accepted
area: repository
applies_to:
  - apps/api/supabase/migrations
  - apps/web/src/features/profile
  - apps/web/src/types/user.ts
  - apps/web/src/providers/supabase
topics:
  - domain
  - user
  - auth
  - profile
  - validation
when_to_read:
  - 認証ユーザー、アプリ内ユーザー、Book membershipの関係を確認するとき
  - 表示名の入力制約または初期登録値を扱うとき
---

# User Domain Rules

## Rules

- アプリ内ユーザーは認証プロバイダーのユーザーと対応する。
- 認証プロバイダーのユーザーIDは `public.users.auth_user_id` として保持し、`auth.users(id)` を参照する。
- `auth_user_id` はアプリ内ユーザーに対して一意である。
- 移行時に `auth_user_id` を backfill できない既存アプリ内ユーザーは削除しないが、通常ログインでは利用できない。
- Auth user が明示削除された場合は、対応するアプリ内ユーザーと user-owned data も cascade で削除される。
- Book membership がなくなったBookは削除され、Book-owned dataもBookのcascadeに従って削除される。
- ユーザーのemailは一意である。
- アプリ内ユーザーは認証同期処理が作成し、クライアントは直接作成しない。
- クライアントが更新できるユーザープロフィール列は `name` のみである。
- ユーザープロフィール更新では、認証中のユーザーに対応する1件が更新されたことを確認し、更新対象が見つからない場合を成功として扱わない。
- `name` はユーザー編集可能な表示名であり、監査・権限・本人確認には使わない。
- 表示名のアプリケーション上限は64文字とする。
- ユーザーが編集した表示名が64文字を超える場合は、保存前にvalidation errorとして扱い、自動的に切り詰めない。
- 初期登録する表示名が64文字を超える場合は、先頭64文字に切り詰めて登録する。
- 認証済み操作では、認証中のユーザーに対応するアプリ内ユーザーが存在する前提で扱う。
- 認証中のユーザーに対応するアプリ内ユーザーが見つからない場合はエラーになる。
- ユーザーはBook membershipを通じてBook-owned dataへアクセスする。
- 新規ユーザーにはdefault bookとmembershipを作成する。
