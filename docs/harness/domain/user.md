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
  - docs/harness/contracts/user-account-attributes.json
topics:
  - domain
  - user
  - auth
  - profile
  - account-preference
  - validation
when_to_read:
  - 認証ユーザー、アプリ内ユーザー、Book membershipの関係を確認するとき
  - ユーザーのプロフィールまたはアカウント設定を追加・変更するとき
  - ユーザー属性の保存先、更新権限、初期値、fallbackを判断するとき
---

# User Domain Rules

ユーザードメインは、認証主体、アプリ内ユーザー、ユーザーが管理できるアカウント属性、
システムが管理する所属とライフサイクルの境界を所有する。

## Identity and lifecycle

- アプリ内ユーザーは認証プロバイダーのユーザーと対応する。
- 認証プロバイダーのユーザーIDは `public.users.auth_user_id` として保持し、`auth.users(id)` を参照する。
- `auth_user_id` はアプリ内ユーザーに対して一意である。
- 移行時に `auth_user_id` を backfill できない既存アプリ内ユーザーは削除しないが、通常ログインでは利用できない。
- Auth user が明示削除された場合は、対応するアプリ内ユーザーと user-owned data も cascade で削除される。
- Book membership がなくなったBookは削除され、Book-owned dataもBookのcascadeに従って削除される。
- ユーザーのemailは一意である。
- アプリ内ユーザーは認証同期処理が作成し、クライアントは直接作成しない。
- 認証済み操作では、認証中のユーザーに対応するアプリ内ユーザーが存在する前提で扱う。
- 認証中のユーザーに対応するアプリ内ユーザーが見つからない場合はエラーになる。

## Attribute ownership

ユーザーに関する値は、次の所有区分で扱う。

- `identity`: 認証主体の識別と本人確認に使う値。認証プロバイダーまたは認証同期処理が所有し、プロフィール更新境界から変更しない。
- `profile`: ユーザーが他の画面で利用する表現を管理する値。認証、監査、認可の根拠には使わない。
- `account_preference`: 同じアカウントの端末間で共有する設定。認証済みアカウントの永続データを正本にする。
- `system_owned`: membership、所有関係、ライフサイクルなどシステムが整合性を管理する値。クライアントのプロフィール更新境界から変更しない。

現在の `profile` と `account_preference` の属性一覧、保存先、書込主体、値制約、初期化規則は
[User Account Attribute Contract](../contracts/user-account-attributes.json) を機械正本とする。
属性の追加や契約変更ではこの一覧を同じタスクのrepresentationとして更新する。

## Persistence and fallback

- 認証済みユーザーの `profile` と `account_preference` は、contractに定義されたアカウント側の保存先を永続的な正本にする。
- ブラウザや端末のlocal storageは、contractが許可する初期値、cache、または取得失敗時のfallbackに限定し、アカウント設定の唯一の保存先にしない。
- 新しい属性は、既存ユーザーに値を推測してbackfillしない。backfill、default、fallbackが必要な場合は、属性contractとタスクの成功条件でそれぞれ明示する。
- アカウント値と端末値の優先順位、読込完了前の表示、取得・保存失敗時の継続可否は、利用者に観測される挙動としてRequirementsと検証へ接続する。

## Mutation boundary

- クライアントは、attribute contractで `client_writable: true` と明示された属性だけを更新できる。
- DB列権限、APIまたはqueryの更新payload、生成型、validationは同じallowlistを表し、行全体や未宣言属性への包括的な更新権限を与えない。
- 更新は認証中のユーザーに対応する行だけへ限定し、RLSによる本人境界と列単位の更新境界を併用する。
- 更新後は対象の1件が更新されたことを確認し、対象行が見つからない場合を成功として扱わない。
- 許容値、長さ、nullability、正規化、初期化、backfill、fallbackのうち属性に関係する契約を、保存処理やUIの推測ではなくattribute contractへ明示する。
- contractに定義されていない切り詰め、補完、変換を保存処理で暗黙に行わない。

## Book access

- ユーザーはBook membershipを通じてBook-owned dataへアクセスする。
- 新規ユーザーにはdefault bookとmembershipを作成する。

## Rule evolution

- 個別属性の追加・削除・値制約変更はattribute contractを更新し、この文書へ列名のallowlistを追記しない。
- 属性の所有区分、永続化原則、認可境界、失敗時の安全原則そのものを変更する場合だけ、このドメインルールを更新する。
- attribute contractの変更は、対応するDB schema、列権限、RLS、型、read/write境界、回帰テストと同じタスクで同期する。
