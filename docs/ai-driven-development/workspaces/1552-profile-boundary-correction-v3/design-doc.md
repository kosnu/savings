---
title: "Design Doc: プロフィール表示名の境界修正"
doc_type: design-doc
status: draft
area: repository
applies_to:
  - docs/ai-driven-development
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - design
  - profile
  - user
  - forms
  - rpc
  - transaction-boundaries
---

# Design Doc: プロフィール表示名の境界修正

## Goal

`requirements.md`のAC-1からAC-9を、表示名のユーザー可視仕様を変えずに満たす。表示名の値ルールはWebアプリケーション層へ集約し、`ensure_authenticated_user`は認証済みユーザー作成の実行境界だけを担う。プロフィールフォームでは、保存開始から完了まで入力とSaveを同じ操作状態へ揃える。

## Inputs

- Requirements / PRD: `docs/ai-driven-development/workspaces/1552-profile-boundary-correction-v3/requirements.md`
- Issue: #1552
- Unresolved review: PR #1576の`AccountInformationForm.tsx`に対する保存開始直後の操作状態不整合。
- 関連コード:
  - `apps/web/src/features/profile/profileSettings/profileSchema.ts`
  - `apps/web/src/features/profile/profileSettings/AccountInformationForm/*`
  - `apps/web/src/providers/supabase/ensureAuthenticatedUser.ts`
  - `apps/web/src/providers/supabase/SupabaseSessionProvider.tsx`
  - `apps/web/src/types/database.types.ts`
  - `apps/api/supabase/migrations/20260621000000_link_users_to_auth_users.sql`
  - `apps/api/supabase/migrations/20260719000000_limit_initial_display_name.sql`
  - `apps/api/supabase/tests/ensure_authenticated_user.test.sql`
- Existing tests:
  - `AccountInformationForm.test.tsx`は`composeStories`で同名Storyを再利用している。
  - `profileSchema.test.ts`は64/65文字とUnicodeコードポイント境界を検証している。
  - `ensureAuthenticatedUser.test.ts`はRPC呼び出し契約を検証している。
  - `SupabaseSessionProvider.test.tsx`は認証確認とユーザー作成の順序・競合を検証している。
  - SQL testは現在、DB内で64文字へ切り詰める挙動を検証している。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `apps/web/src/domain/**`, `apps/web/src/features/profile/**`, `apps/web/src/providers/supabase/**`, `apps/api/supabase/**`
  - domain: `user`, `auth`, `web`
  - activity: `change_form`, `change_rpc_contract`, `change_transaction_boundary`, `review_test_gap`
  - topic: `profile`, `display-name`, `validation`, `forms`, `rpc`, `test`
- Selected nodes:
  - `domain.user` -> `docs/harness/domain/user.md`: 64文字上限、編集時拒否、初期登録時切り詰めを維持する。
  - `policy.transaction-boundaries` -> `docs/harness/policies/transaction-boundaries.md`: 実行境界と値ルール所有境界を分ける。
  - `web.design-rules` -> `apps/web/docs/policies/design-rules.md`: 送信を1つのユーザー操作状態にする。
  - `web.component-structure` -> `apps/web/docs/policies/component-structure.md`: 既存component責務とStory境界を維持する。
  - `web.test-policy` -> `apps/web/docs/policies/test-policy.md`: component testでStoryを正本として再利用する。
  - `web.storybook-browser-tests` -> `apps/web/docs/policies/storybook-browser-tests.md`: component Storyをbrowser-testへ不要に拡張しない。
  - `web.feature-directory` -> `apps/web/docs/policies/feature-directory.md`: feature外でも使う値ルールをfeature内部へ残さない。
  - `web.domain-layer-rules` -> `apps/web/docs/policies/domain-layer-rules.md`: Web全体で共有する表示名ルールをdomainに置く。
- Depends-on nodes: 追加なし。
- Conflict decision: 旧migrationとSQL testは64文字ルールをDBへ所有させているため、最新の`policy.transaction-boundaries`を優先して置き換える。ユーザー可視挙動は`domain.user`に従って維持する。

## Current State

### 初期登録

現在の`ensure_authenticated_user()`は引数を持たず、DB内でJWTの`user_metadata.name`、`full_name`、email local-part、`User`の順に初期名を導出する。branch上の最新migrationは、そのDB内導出値へ`left(..., 64)`を適用している。

この構造では、RPCという実行手段が、認証済みユーザー作成の原子性だけでなく、Web固有の64文字上限と初期値fallbackまで所有する。保存先は255文字まで保持できるため、64文字はDB整合性ではなくWebアプリケーションの値ルールである。

### プロフィール保存

`AccountInformationForm`は、Saveを`isSubmitting || isPending`でloadingにする一方、inputを`isPending`だけでdisabledにする。`form.handleSubmit()`が受理されて`onSaveDisplayName`がmutation pendingへ遷移するまで、Saveだけ操作不可でinputは操作可能になる状態差がある。

### Storyとtest

`Saving` Storyは`isPending: true`をpropsで与えるため、form内部の`isSubmitting: true / isPending: false`を通過しない。したがって既存testは「mutation pending時」を検証できるが、「保存受付直後」を回帰検証できない。

## Domain Value UI Decisions

- 対象値は、表示名の実値、64文字以内かというvalidation結果、保存中という操作状態である。
- 通常時は表示名の実値をinputに表示し、上限超過時は値を保持したままfield errorを入力直下へ表示する。
- 保存中は新しい文言や状態表示を追加せず、既存のSave spinnerとinput / Saveのdisabledで同一操作中であることを示す。
- 保存成功・失敗の表示位置、文言、read-only値、左寄せの操作群、responsive構造は変更しない。
- 0、empty、権限不足、削除済み、期間比較はこの変更に関係しない。空文字は既存schemaどおりfield errorとする。

## Adopted Design

### 1. 表示名の値ルールをWeb domainへ集約する

`apps/web/src/domain/displayName.ts`を追加し、次を同じ値概念の公開APIとして持たせる。

- `DISPLAY_NAME_MAX_LENGTH = 64`
- `displayNameSchema`: 必須条件とUnicodeコードポイント64文字上限。
- `toInitialDisplayName(source)`: `name`、`fullName`、email local-part、`User`の順でtrim済みの非空値を選び、Unicodeコードポイントの先頭64文字を返す。

`source`はSupabase型へ依存しない構造にし、providerが`session.user.user_metadata`と`session.user.email`を対応付ける。これにより、値ルールは認証SDKや画面componentではなくWeb domainが所有する。

既存の`profileSchema.ts`はAPI responseのschemaと`Profile`型だけを持つ。フォーム、Story、i18n message変換は`domain/displayName`を直接importする。既存の境界テストは`domain/displayName.test.ts`へ移し、初期値fallback、64/65文字、補助平面文字も同じ正本を検証する。

### 2. Webで確定した初期表示名をRPCへ明示的に渡す

`SupabaseSessionProvider`は、現在どおり`auth.getUser()`でsessionの有効性を確認した後、対象sessionのuser情報を`toInitialDisplayName`へ渡す。その戻り値を`ensureAuthenticatedUser(initialDisplayName)`へ渡す。

`ensureAuthenticatedUser`は次のRPC契約を使う。

```ts
supabase.rpc("ensure_authenticated_user", {
  p_initial_display_name: initialDisplayName,
})
```

`getUser()`の検証順序、session generation、同一ユーザー更新時のsession保持、失敗時sign outは変更しない。名前のsourceも従来のJWT相当のsession user metadataとemailを使うため、ユーザー可視のfallback順序は変わらない。

### 3. RPCは実行境界と認証境界だけを維持する

未mergeの`20260719000000_limit_initial_display_name.sql`は削除し、同じtimestampの`20260719000000_accept_initial_display_name.sql`へ置き換える。

新migrationは次を行う。

1. 既存のno-arg `public.ensure_authenticated_user()`をdropする。
2. `public.ensure_authenticated_user(p_initial_display_name text)`を作成する。
3. `auth.uid()`、JWT email、既存auth user、email競合、例外処理、`security definer set search_path = ''`をそのまま維持する。
4. 新規insertの`name`には`p_initial_display_name`をそのまま使う。
5. `public`と`anon`からrevokeし、`authenticated`へexecuteをgrantする。既存と同じ権限境界を維持する。

RPCは64、fallback、trimを知らず、Webが適用済みの値を保存する。直接RPCを呼んだ値へWebの64文字制約を再適用しない。storageの既存型制約、auth UIDとemailの検証、競合防止はDB境界に残す。

`database.types.ts`のfunction Argsを`{ p_initial_display_name: string }`へ同期する。

SQL testは64/65文字を検証しない。Webから渡した名前をそのまま初期登録することと、同じauth userに対する再実行で既存名を変更しないことを検証する。64文字境界はWeb domain testだけが所有する。

### 4. form全体で単一の保存状態を導出する

`AccountInformationForm`では`form.Subscribe`から`isSubmitting`を取得し、component propの`isPending`と合わせた`isSaving`を1か所で導出する。同じ`isSaving`を次へ渡す。

- display name inputの`disabled`
- Saveの`loading`と、それに伴うdisabled

`form.Subscribe`はinputと操作群の両方を包含する。別々の開始・終了条件を持つ状態は追加しない。保存結果alert、field error、read-only値、左寄せ配置、既存callbackは変更しない。

### 5. Saving Storyを保存受付直後の正本へ変更する

`Saving` Storyは`isPending: true`を直接与えず、解決しない`onSaveDisplayName`を設定し、playで表示名を変更してSaveを押す。これにより、form内部の`isSubmitting: true`かつexternal `isPending: false`を再現する。

`AccountInformationForm.test.tsx`は現在どおり`composeStories`で`Saving`を再利用し、Storyのplay後にinputとSaveがdisabled、spinnerが表示されることを確認する。test専用のcomponent直書きや内部state操作は追加しない。

このStoryはcomponent単体の状態であり、同名testで十分に検証できるため`browser-test` tagは追加しない。

## Data Flow

```text
validated Session.user
  -> Web domain: metadata/email fallback + trim + Unicode code-point max 64
  -> ensureAuthenticatedUser(initialDisplayName)
  -> ensure_authenticated_user(p_initial_display_name)
  -> DB: auth UID/email verification + existing-user conflict handling + atomic insert
```

表示名編集時は次のままとする。

```text
AccountInformationForm
  -> Web domain displayNameSchema
  -> valid value only
  -> existing update mutation
  -> refetch success confirms save
```

## Transaction and Ownership Boundaries

| Concern | Owner | Reason |
| --- | --- | --- |
| 初期表示名のfallback、trim、64文字切り詰め | Web domain | 特定アプリケーションの表示名UXであり、storageはより広い値を保持できる。 |
| 編集表示名の必須・64文字validation | Web domain | 初期登録と同じ値ルールを共有する。 |
| sessionの有効性確認 | Web auth provider | 認証済み画面状態へ進める前提。 |
| auth UID/emailの信頼境界 | DB/RPC | 呼び出し引数ではなくJWTから取得し、なりすましを防ぐ。 |
| userとdefault book/membership作成の原子性 | DB/RPCと既存trigger | 片成功を防ぐ既存実行境界。 |
| email競合と既存userのidempotency | DB/RPC | 保存データの整合性と認証連携を守る。 |
| 保存中の操作可否 | AccountInformationForm | 1つのフォーム送信状態として扱う。 |

RPCが表示名引数を受け取っても、認証UIDやemailを引数から受け取らない。authenticated userは既に自分の`users.name`を更新できるため、初期名を引数化しても新しい権限は付与しない。

## File Changes

### Add

- `apps/web/src/domain/displayName.ts`: 表示名schema、上限、初期値正規化。
- `apps/web/src/domain/displayName.test.ts`: 編集と初期登録の値境界。
- `apps/api/supabase/migrations/20260719000000_accept_initial_display_name.sql`: 引数付きRPC契約。
- `docs/ai-driven-development/workspaces/1552-profile-boundary-correction-v3/design-doc.md`: この設計。

### Modify

- `apps/web/src/features/profile/profileSettings/profileSchema.ts`: response schemaとProfile型だけにする。
- `apps/web/src/features/profile/profileSettings/AccountInformationForm/AccountInformationForm.tsx`: 共通`isSaving`をinputとSaveへ適用する。
- `apps/web/src/features/profile/profileSettings/AccountInformationForm/AccountInformationForm.stories.tsx`: Savingをform submissionで再現する。
- `apps/web/src/features/profile/profileSettings/AccountInformationForm/AccountInformationForm.test.tsx`: Saving Storyのplayを実行して保存受付直後を検証する。
- `apps/web/src/i18n/translateMessage.ts`: 表示名定数のimport先をdomainへ変更する。
- `apps/web/src/providers/supabase/ensureAuthenticatedUser.ts`: 初期名を引数で受け、RPCへ渡す。
- `apps/web/src/providers/supabase/ensureAuthenticatedUser.test.ts`: RPC名とargsを検証する。
- `apps/web/src/providers/supabase/SupabaseSessionProvider.tsx`: session userから初期名を作り、ensureへ渡す。
- `apps/web/src/providers/supabase/SupabaseSessionProvider.test.tsx`: 初期名引数を含む呼び出しを検証する。
- `apps/web/src/types/database.types.ts`: RPC Argsを同期する。
- `apps/api/supabase/tests/ensure_authenticated_user.test.sql`: 値のpass-throughとidempotencyを検証する。

### Delete

- `apps/web/src/features/profile/profileSettings/profileSchema.test.ts`: 表示名rule testをdomain testへ移す。
- `apps/api/supabase/migrations/20260719000000_limit_initial_display_name.sql`: DB所有の64文字ruleを除去する。

### Unchanged

- `20260621000000_link_users_to_auth_users.sql`: 過去migrationは書き換えず、新migrationで契約を移行する。
- `AccountInformation`、mutation、query、Page Story: データ取得・保存結果・browser integrationの責務は変わらない。
- DB table、column、RLS、grant対象role、Auth設定。

## Acceptance Criteria Traceability

| AC | Design / verification |
| --- | --- |
| AC-1, AC-2, AC-3 | `domain/displayName.test.ts`と既存Form Story testで64/65文字、値保持、callback未実行を検証する。 |
| AC-4 | `toInitialDisplayName`の65文字・Unicode境界testとproviderからRPCへの引数testで検証する。 |
| AC-5 | `Saving` Storyがexternal pending前のform submissionを保持し、inputとSaveのdisabledを検証する。 |
| AC-6 | success/error Story testと`isSaving`単一定義により、同じ保存完了条件から復帰する。 |
| AC-7 | 既存AccountInformationForm、ProfileSettings、SessionProvider testを回帰実行する。 |
| AC-8 | migration diffでtable/RLS/Auth/grant roleが不変であることを確認する。 |
| AC-9 | 64文字を含まないRPC/SQL test、共通`isSaving`、Story再利用で正本ルール適合を確認する。 |

## Alternatives Not Adopted

### DB/RPC内で`left(..., 64)`を維持する

不採用。RPCを初期作成の実行境界に選んだことと、64文字ルールの所有先は別である。storageがより広い値を保持できるため、DBでの再定義は`policy.transaction-boundaries`に反する。

### WebとDBの両方で64文字を適用する

不採用。現在の挙動は守れるが、同じアプリケーションルールが二重化し、将来の上限変更時に契約が分岐する。

### 初期ユーザー作成をWebからtable insertへ変更する

不採用。user、default book、membershipの既存原子性とsecurity definer境界を崩す。今回必要なのは値ルールの移動であり、実行境界の撤去ではない。

### session user全体をRPCへ渡す

不採用。auth UIDとemailはJWTから取得する信頼境界を維持する。RPCへ渡すのはWebが所有する初期表示名だけにする。

### inputだけへ別の`form.Subscribe`を追加する

不採用。同じform stateを参照できても、inputとSaveの操作状態を別々に組み立てる構造が残る。1つの`isSaving`を両方へ渡す方がルールを構造で表現できる。

### test側でcomponentを直接renderして内部状態を作る

不採用。Savingはユーザーが直接見る永続状態でありStoryの責務で表現できる。test policyどおりStoryを正本として再利用する。

## Verification Plan

Build後、repository rootから次を実行する。

1. `pnpm run web:format`
2. 同一batchで並列実行:
   - `pnpm run web:lint`
   - `pnpm run web:format-check`
   - `pnpm run web:typecheck`
   - `pnpm run web:test:unit-integration`
3. `git diff --check`
4. Supabase local runtimeが利用可能なら`pnpm --filter api exec supabase test db`またはrepositoryの既存Supabase test commandを確認して実行する。利用不能なら、理由と未検証のSQL境界を明記する。

component Storyのみの変更で`browser-test`対象、`.storybook-test`、Storybook browser-test設定を変更しないため、`pnpm run web:test:storybook`は不要とする。

## Risks and Mitigations

- RPC signature drift: migration、Web call、mock expectation、generated typeを同じ変更で同期し、typecheckで検出する。
- session metadata差分: 現行DBが参照するJWTと同じsession userの`name`、`full_name`、email fallback順をdomain testで固定する。
- Unicode切り詰め差分: `Array.from`でコードポイント単位に切り詰め、既存schemaと同じ数え方にする。
- migration未検証: local Supabaseが起動できない場合はSQL test未実行をShip報告に残し、CI結果を待つ。
- 未解決reviewの再発: Saving Storyをexternal `isPending`に依存させず、form-owned `isSubmitting`を通す。

## Stop Conditions

- 引数付きRPCへの移行にtable、column、RLS、Auth方式、grant対象roleの変更が必要になる。
- session userから従来と同じ初期表示名を導出できない。
- user/default book/membershipの原子性を維持できない。
- `isSubmitting`とmutation pendingを1つの操作状態として扱うと既存の成功・失敗要件が変わる。
- RequirementsのACまたは対象外を変更する必要がある。

## Build / Verify Handoff

- Artifact lineage: `docs/ai-driven-development/workspaces/1552-profile-boundary-correction-v3/`
- 実装順序:
  1. Web domainへ表示名ruleとtestを移す。
  2. session providerから初期名をRPC引数へ渡し、unit testとgenerated typeを同期する。
  3. migrationとSQL testをDB非依存の64文字ruleからpass-through契約へ置き換える。
  4. Formの`isSaving`を統一し、Saving Story/testを保存受付直後へ変更する。
  5. Web verification、SQL test可能性確認、diff確認を行う。
