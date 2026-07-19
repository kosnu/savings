---
title: "Design: プロフィール表示名制約とRetry focusのフォローアップ"
doc_type: design
status: draft
area: repository
applies_to:
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - design
  - profile
  - validation
  - accessibility
  - authentication
---

# Design: プロフィール表示名制約とRetry focusのフォローアップ

## Artifact Premise

このDesign Docは、[requirements.md](./requirements.md)をread-only入力として、FR-1〜3とAC-1〜9を実装可能な変更へ落とし込む。既存の1552系artifactは変更しない。

変更は、表示名の64文字制約、初期登録値の正規化、既存Retry失敗後のfocus成立に限定する。新しいユーザー操作、DB schema、API契約、Auth方式、権限、RLSは追加・変更しない。

## Goal

- ユーザー編集時は64文字を超える表示名を保存前にfield validationで拒否する。
- 初期登録時だけ、認証情報から決めた表示名を先頭64文字へ切り詰める。
- Retry失敗後、pending解除済みのRetry buttonへ実ブラウザでfocusを戻す。
- 境界値とfocus状態をStoryを基準に回帰検証する。

## Non-Goals

- `public.users.name`の型・制約変更
- 既存ユーザーの表示名の一括更新
- ユーザー編集値の自動切り詰め
- email、provider、LanguageSelect、Retry成功時遷移の仕様変更
- 新しい共通component、hook、schema layerの追加

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `apps/web/src/features/profile/**`, `apps/web/src/app/routes/SettingsPage/**`, `apps/web/src/i18n/**`, `apps/api/supabase/migrations/**`
  - domain: `user`, `auth`, `web`
  - activity: `change_form`, `change_user_behavior`, `change_auth_assumption`, `review_test_gap`
  - topic: `profile`, `validation`, `accessibility`, `auth`, `test`
- Selected nodes:
  - `domain.user` -> `docs/harness/domain/user.md`: 64文字上限、編集時拒否、初期登録時切り詰めの正本。
  - `web.design-rules` -> `apps/web/docs/policies/design-rules.md`: field error、pending、disabled、focusの状態表現。
  - `web.component-structure` -> `apps/web/docs/policies/component-structure.md`: 既存component境界とStory責務を維持するため。
  - `web.test-policy` -> `apps/web/docs/policies/test-policy.md`: component testでStoryを原則再利用するため。
  - `web.storybook-browser-tests` -> `apps/web/docs/policies/storybook-browser-tests.md`: 実ブラウザfocusをPage Storyで検証するため。
  - `web.suspense-boundaries` -> `apps/web/docs/policies/suspense-boundaries.md`: profile error fallbackとLanguageSelectの独立境界を維持するため。
  - `web.msw-handlers` -> `apps/web/docs/policies/msw-handlers.md`: StoryとtestのAPI状態を同じhandler factoryで表現するため。
  - `documentation.policy` -> `docs/harness/policies/documentation-policy.md`: artifact形式を維持するため。
- Depends-on nodes: 追加なし。
- Conflict decision: Requirementsの判断どおり、古い一般的なDB変更Stop条件より最新の明示Task Contextを優先する。ただし許可するのは既存初期登録関数内の値正規化だけで、schema、signature、grant、RLSは変更しない。

## Current Implementation Inventory

| 境界 | 現在 | 変更後 |
| --- | --- | --- |
| `profileSchema.ts` | 表示名の空白のみ検証 | 64文字上限と上限定数を追加 |
| `AccountInformationForm` | schemaでsubmit validation | 同じschemaで65文字をfield errorにし、save callbackを呼ばない |
| i18n | empty messageのみ翻訳 | max messageと`max: 64` interpolationを追加 |
| `ensure_authenticated_user()` | 認証metadata等から名前を決め、そのままinsert | 名前決定後、insert値だけ先頭64文字に正規化 |
| `ProfileLoadError` | reject時、buttonがdisabledのままfocusを試行 | pending解除後にenabledなbuttonへfocus |
| `SettingsPage` Story | profile正常系のbrowser test | profile load/retry失敗の実ブラウザfocus Storyを追加 |

## Display Name Length Semantics

### Adopted Meaning

「1文字」はUnicodeコードポイント1個として扱う。

- Web: `Array.from(value).length`
- PostgreSQL: `char_length(text)` / `left(text, 64)`と同じ文字単位

JavaScriptの`string.length`はUTF-16 code unit数であり、補助平面文字を2と数える。一方、PostgreSQLの`left(text, n)`は文字数で処理する。Webと初期登録で同じ上限を成立させるため、既存の単純なZod `.max(64)`ではなく、code point数を検証する`refine`を使う。

書記素クラスタ単位にはしない。結合文字列の見た目上の1文字を特別扱いする要件はなく、ブラウザとDBで追加ライブラリなしに同じ境界を持てる最小の定義がcode pointだからである。

### Web Schema

`profileSchema.ts`に`DISPLAY_NAME_MAX_LENGTH = 64`をexportし、`displayNameSchema`へ次の順序でrefineを適用する。

1. `trim()`後が空でないこと。
2. `Array.from(value).length <= DISPLAY_NAME_MAX_LENGTH`であること。

上限エラーのschema messageは`Display name must be 64 characters or less`とする。フォームは既存どおりsubmit時に検証し、65文字以上の値を保持したまま入力直下にerrorを表示する。`maxLength`属性は付けない。入力自体を64文字で止めると、初期値や貼り付け値を黙って拒否し、field validationで理由を示す要求を弱めるためである。

### Translation

- key: `validation.displayName.max`
- English: `Display name must be {{max}} characters or less`
- Japanese: `表示名は{{max}}文字以内で入力してください`
- interpolation: `{ max: DISPLAY_NAME_MAX_LENGTH }`相当の64

schema messageと`translateMessage`のmappingを同期する。

## Initial Registration Normalization

新規migrationを1つ追加し、`public.ensure_authenticated_user()`を`create or replace`する。既存関数を全文コピーし、次だけを変更する。

```sql
authenticated_name := left(
  coalesce(...existing candidates...),
  64
);
```

空白除去、metadata優先順、email local-part fallback、`User` fallback、既存userのearly return、email衝突処理、exception文言、`security definer set search_path = ''`、revoke/grantを維持する。`left`は候補値が確定した後に一度だけ適用し、64文字以内の値は変えない。

このmigrationは新規登録だけへ作用する。既存行の`update`、column alteration、constraint、trigger、API signatureは含めない。

### Migration Test

`apps/api/supabase/tests/ensure_authenticated_user.test.sql`を追加し、transaction内のpgTAP testとして次を検証する。

- 64文字のmetadata nameはそのまま登録される。
- 65文字のmetadata nameは先頭64文字で登録される。

testは一時的な`auth.users`とJWT claimsを準備し、公開関数`ensure_authenticated_user()`を呼ぶ。関数内部の式だけを複製して検証しない。終了時にrollbackする。Supabase local stackが利用可能なら`supabase test db`を実行する。リポジトリにAPI test scriptはないため、local stackが利用できない場合は未実行理由を明記し、migration差分とSQL test自体をレビュー対象にする。

## Retry Focus State Transition

`ProfileLoadError`は引き続きretry pendingとfocusを所有する。新しいpropは追加しない。

| 状態 | button | focus処理 |
| --- | --- | --- |
| idle/error fallback | enabled | なし |
| retry pending | disabled、`aria-busy=true`、spinner | なし |
| retry success | componentが親のresetでunmount | 親の既存heading focusに委ねる |
| retry failure直後 | pendingを解除 | focus requestを記録 |
| retry failure・再操作可能 | enabled | effectでRetry buttonへfocusし、requestを消費 |

実装は`shouldFocusRetry` booleanと`useEffect`を使う。catchでfocus requestを立て、finallyで`isRetrying=false`にする。effectは`shouldFocusRetry && !isRetrying`のときだけbuttonへfocusし、requestをfalseへ戻す。これによりdisabled要素へのfocusを避ける。成功時はrequestが立たず、既存の親focusを妨げない。

## Story and Test Design

### `profileSchema.test.ts`

- 64 ASCII code points: success。
- 65 ASCII code points: max messageでfailure。
- 64 supplementary-plane code points: success。
- 65 supplementary-plane code points: failure。

Unicodeケースにより、WebとPostgreSQLの文字単位を意図的に固定する。

### `AccountInformationForm.stories.tsx` / `.test.tsx`

`DisplayNameTooLong` Storyを追加し、playで65文字を入力してSaveする。既存provider、args、初期値をStoryに置き、testは`composeStories`で再利用する。

testは次を確認する。

- field errorが64文字以内への修正を要求する。
- inputは65文字のままで、自動切り詰めされない。
- `onSaveDisplayName`が呼ばれない。

64文字の保存可否は、既存`Saved`の入力値を64文字にしてcallback呼び出しまで確認するか、境界専用`DisplayNameAtLimit` Storyを追加して検証する。Storyの責務を明確にするため、境界専用Storyを採用する。

### `ProfileLoadError.stories.tsx` / `.test.tsx`

既存`RetryFailed` Storyを維持する。component testは`composeStories`で、reject後にbuttonがenabledかつfocusedであることを確認する。JSDOM testはstate transitionの高速な回帰確認であり、実ブラウザ検証の代替にはしない。

### `SettingsPage.stories.tsx`

`ProfileRetryFailed` Page Storyを追加する。

- `/settings/profile` router構成は`Profile` Storyと同じ。
- MSWは`createProfileHandlers({ get: { error: true } })`を使い、初回GETとRetry GETを失敗させる。
- playはload alertとLanguageSelectの存在を確認し、Retryをclickする。
- request完了後、Retryがenabledで`document.activeElement`であることを確認する。

SettingsPage metaには既に`browser-test` tagがあり、`.storybook-test`のPage Story対象条件を満たす。component Storyにtagは追加しない。

### Existing Regression Coverage

- `AccountInformation.test.tsx`: `errorOnce`のRetry成功とheading focusを維持。
- `ProfileSettings.test.tsx`: loading/error中のLanguageSelect操作性を維持。
- provider fallback testsを維持。

## Requirements Traceability

| Requirement | Implementation | Verification |
| --- | --- | --- |
| FR-1 / AC-1〜3 | `profileSchema.ts`, i18n, `AccountInformationForm` Story/test | 64/65、field error、callback未実行、値保持 |
| FR-2 / AC-4〜6 | 新規migration、Supabase SQL test | 64保持、65切り詰め、schema差分なし |
| FR-3 / AC-7 | `ProfileLoadError.tsx`, component Story/test, SettingsPage Page Story | pending解除後のenabled/focusをJSDOMと実ブラウザで確認 |
| AC-8 | 既存AccountInformation/ProfileSettings tests、Profile Page Story | Retry成功、LanguageSelect、provider fallback |
| AC-9 | selected policy確認、diff review | policy違反なし |

## Files to Change

### Add

- `apps/api/supabase/migrations/<timestamp>_limit_initial_display_name.sql`
- `apps/api/supabase/tests/ensure_authenticated_user.test.sql`
- `apps/web/src/features/profile/profileSettings/profileSchema.test.ts`

### Modify

- `apps/web/src/features/profile/profileSettings/profileSchema.ts`
- `apps/web/src/features/profile/profileSettings/AccountInformationForm/AccountInformationForm.stories.tsx`
- `apps/web/src/features/profile/profileSettings/AccountInformationForm/AccountInformationForm.test.tsx`
- `apps/web/src/features/profile/profileSettings/ProfileLoadError/ProfileLoadError.tsx`
- `apps/web/src/features/profile/profileSettings/ProfileLoadError/ProfileLoadError.test.tsx`
- `apps/web/src/app/routes/SettingsPage/SettingsPage.stories.tsx`
- `apps/web/src/i18n/translateMessage.ts`
- `apps/web/src/i18n/resources.ts`

### No Planned Change

- component directory structureとpublic props
- profile query/mutation/API adapter
- `public.users` table definition、RLS、grant model
- auth metadataそのもの
- LanguageSelect/provider表示の実装
- 既存1552系Requirements / Design Doc

## Alternatives Not Chosen

### Zod `.max(64)`を使う

UTF-16 code unit数となり、PostgreSQLの`left(text, 64)`と補助平面文字で境界がずれるため採用しない。

### inputに`maxLength=64`を付ける

65文字の値を保持してfield errorで修正理由を示すRequirementsと合わないため採用しない。

### 編集時も保存前に切り詰める

FR-1と`domain.user`が明示的に禁止しているため採用しない。

### Retryのcatch内で直接focusする

React state更新前でbuttonがdisabledのままになる可能性があり、実ブラウザでfocusできないため採用しない。

### component testだけでfocusを確認する

JSDOMはdisabled要素のfocusabilityを実ブラウザと同等に保証しない。AC-7が実ブラウザを要求するためPage Story browser testを追加する。

## Risks and Checks

- SQL testのJWT claimsと`auth.users` fixtureがローカルSupabaseのAuth schemaに適合するかをBuildで確認する。
- `ensure_authenticated_user()`の全文再定義時に既存exception、security、grantを欠落させないよう、直前定義との差分を正規化箇所以外ゼロにする。
- Storybookの全Page Storyがbrowser-test対象なので、新規StoryのMSW状態が他Storyへ漏れないことをhandler factoryで保証する。
- code point単位は書記素クラスタ単位ではない。この差はRequirementsの64文字上限とDB整合を満たす範囲で受容する。

## Verification

Build後、repository rootから次を実行する。

1. `pnpm run web:format`
2. 同一batchで並列実行:
   - `pnpm run web:lint`
   - `pnpm run web:format-check`
   - `pnpm run web:typecheck`
   - `pnpm run web:test:unit-integration`
3. Page Storyを変更するため`pnpm run web:test:storybook`
4. local Supabaseが利用可能なら`supabase test db`
5. `git diff --check`

## Stop Conditions

- 64文字の意味をcode point以外へ変更するプロダクト判断が必要になる。
- 初期登録値の正規化にschema、API、Auth方式、権限、RLS変更が必要になる。
- 既存関数のsecurity、exception、同期動作を変えないとmigrationを適用できない。
- 実ブラウザStoryでRetry失敗後のfocusを検証できない。
- component structure/test policyと変更境界が衝突する。

## Build Input

- Artifact lineage: `docs/ai-driven-development/workspaces/1552-profile-review-follow-up-v2/`
- Build / VerifyはこのDesign DocとRequirementsをread-only入力として、上記Files to Changeと検証範囲に限定する。
