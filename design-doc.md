---
title: "Design Doc: 言語設定をアカウントに保存して端末間で同期する"
doc_type: design
status: draft
area: repository
applies_to:
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - design-doc
  - language
  - profile
  - user
  - auth
when_to_read:
  - Issue #1563 の言語設定同期を実装するとき
  - アカウント言語と端末内fallbackの状態境界を確認するとき
---

# Design Doc: 言語設定をアカウントに保存して端末間で同期する

## 目的

[Requirements / PRD](./requirements.md) に従い、`public.users.language` を認証済みユーザーの言語設定source of truthとして追加し、ログイン後の同期、明示的な言語変更の保存、未設定・取得失敗・保存失敗の境界を実装可能な設計へ落とし込む。

Requirementsはread-onlyの入力とする。対応言語、テーマ、未認証ユーザーのaccount設定、設定ナビゲーション、`name` / `language` 以外の更新権限は変更しない。

## Current State

- `apps/web/src/i18n/index.ts` は起動時に `localStorage.appLanguage` を読み、言語変更イベントで同じkeyへ保存する。
- `LanguageSelect` はi18n言語を即時変更し、account保存やpending/error状態を持たない。
- `Provider` は `QueryClientProvider`、`SupabaseSessionProvider`、`ThemeProvider`、`SnackbarProvider` を構成する。
- `public.users` のauthenticated列権限は `name` のupdateだけを許可し、`updated_at` triggerも `name` updateだけを対象とする。
- WebのDatabase型、profile schema、users用MSW handlerに `language` はない。
- `profile` queryはAccount Informationの `name` / `email` を所有し、Appearanceの言語設定は別featureにある。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `design-doc.md`, `apps/api/supabase/migrations/**`, `docs/harness/domain/user.md`, `apps/web/src/**`
  - domain: `user`, `auth`, `database`, `web`, `ui`, `test`
  - activity: `write_design_doc`, `change_database`, `change_user_behavior`, `change_query`, `change_mutation`, `change_ui`, `add_test`
  - topic: `language`, `profile`, `react-query`, `RLS`, `MSW`, `regression`
- Selected:
  - `ai-driven.workflow`, `ai-driven.goal-templates`: Design責務、Requirements read-only、Done/Stopを守るため。
  - `architecture.overview`, `infrastructure.overview`: WebとSupabase PostgreSQLの境界を維持するため。
  - `domain.user`: 本人行、更新対象1件、更新可能列の契約を `name` / `language` に限定して同期するため。
  - `policy.transaction-boundaries`: 1回の言語選択でDBだけ、またはbrowserだけが成功した状態を確定させないため。
  - `web.feature-directory`, `web.component-structure`: preferences featureのユースケースsliceと非表示同期componentを既存構造へ配置するため。
  - `web.query-cache`: DBをsource of truthとし、mutation後の再取得成功まで完了扱いにしないため。
  - `web.suspense-boundaries`: globalなaccount言語取得をpage-blockingなSuspense/error境界にしないため。
  - `web.test-policy`, `web.msw-handlers`, `web.storybook-browser-tests`: 実API境界、状態遷移、Storyとbrowser testの範囲を決めるため。
  - `web.design-system-brand`, `web.design-rules`: disabled、成功・失敗notificationを既存設定UIの密度と意味色に合わせるため。
- Depends-on:
  - `infrastructure.overview`, `policy.transaction-boundaries` の前提として `architecture.overview`。
  - `web.suspense-boundaries` の前提として `web.query-cache`, `web.test-policy`。
  - `web.msw-handlers`, `web.storybook-browser-tests` の前提として `web.test-policy`。
- Conflict decision: 最新Issueの監督入力により、`domain.user` のname-only契約をname+languageへ限定拡張する。本人行、exactly-one、他列禁止は優先して維持する。DB/API/権限変更は同じ監督入力で承認済みの範囲に限定する。

## 採用する設計

### 1. Database contract

新しいmigrationを1つ追加する。

- `public.users.language` をnullable `text` として追加する。
- DB check constraintで非null値を `en` / `ja` に限定する。
- defaultは設定しない。既存行は `null` のままとし、migrationやloginで推測backfillしない。
- authenticatedのtable-wide updateをrevokeしたうえで、column grantを `update (name, language)` に限定する。email、`auth_user_id`、timestamps、legacy列などへ権限を広げない。
- 既存の本人行RLS policyを維持する。新規policyやRPCは追加しない。
- `trg_update_user_updated_at` を `before update of name, language` に作り直し、どちらのprofile更新でも `updated_at` を更新する。

単一の本人行に対する1列updateであり、複数recordや複数tableの原子更新はない。DB transaction functionを追加せず、PostgRESTの1 updateを実行境界とする。

### 2. Canonical rule and generated type

- `docs/harness/domain/user.md` の更新可能列を `name` と `language` に変更する。
- `language` は本人が選択できる `en` / `ja` / 未設定のaccount preferenceであり、認証、本人確認、権限判定に使わないことを追記する。
- `apps/web/src/types/database.types.ts` のusers Row / Insert / Updateへnullable languageを同期する。DB生成型は `string | null` とし、許可値のnarrowingはWeb schemaで行う。

### 3. Preferences feature ownership

言語account APIは `apps/web/src/features/preferences/languagePreference/` に置く。保存テーブルがusersであっても、利用目的とUIがAppearanceの言語設定であり、Account Informationのname/email queryへ責務を混ぜない。

追加する目的別module:

- `languagePreferenceSchema.ts`: `en` / `ja`、nullable response、update responseを検証する。
- `languagePreferenceQueryKeys.ts`: auth user IDを含むcurrent query keyを定義する。
- `fetchLanguagePreference.ts`: `users.select(language).eq(auth_user_id).maybeSingle()` を実行し、null rowや不正値を成功にしない。
- `updateLanguagePreference.ts`: `{ language }` を本人IDで更新し、`auth_user_id, language` を `.single()` で受け取り、対象IDと値が一致する1件だけを成功にする。
- `useLanguagePreference.ts`: authenticated user IDがある場合だけqueryを有効にし、data/error/pendingを返す。Suspenseでchildrenを止めない。
- `useUpdateLanguagePreference.ts`: update後に同じqueryを強制refetchし、再取得値が選択値と一致した場合だけconfirmed languageを返す。`setQueryData`、optimistic update、browser側の先行確定は行わない。

同じfeatureの `LanguagePreferenceSync/` componentは、authenticated sessionとlanguage queryを接続する非表示の同期境界とする。component policyに従い同名directoryと`index.ts`を置く。ユーザーが直接操作・閲覧する独立UIではないためStoryは追加せず、MSWを通すcomponent testで責務を確認する。

### 4. Login / account synchronization

`Provider` の `SnackbarProvider` 内に `LanguagePreferenceSync` を置き、通常のchildrenは常に描画する。

- auth statusがauthenticatedになったユーザーIDでqueryを開始する。
- query successかつaccount languageがnon-nullなら、`i18n.changeLanguage(accountLanguage)` を呼ぶ。既存 `languageChanged` listenerが同じ値をlocalStorageへmirrorする。
- query successかつaccount languageがnullなら何も書き込まず、起動時に決まったlocalStorage値または既定 `en` を維持する。
- query failureでもchildrenを置き換えず、現在のfallback言語を維持し、error snackbarを1回表示する。
- unauthenticated/loadingではaccount queryを実行せず、現在のi18n値を維持する。

React Query cacheは取得結果のcacheであり、言語source of truthにしない。query keyはユーザーIDを含め、ユーザー切替時に別accountのcacheを再利用しない。

### 5. Explicit language change

既存 `LanguageSelect` の見た目・ラベル・配置は維持し、保存動作だけを変更する。

1. 現在値と異なる `en` / `ja` が選択されたら、authenticated user IDと選択値でmutationを開始する。
2. 初回account query中またはsave中はSelect全体を実際にdisabledにし、重複選択を防ぐ。
3. DB updateと強制refetchが成功し、取得値が選択値と一致した場合だけ `i18n.changeLanguage(confirmedLanguage)` を実行する。
4. 既存listenerがconfirmed languageをlocalStorageへmirrorする。
5. 新しい言語でsuccess snackbarを表示する。
6. update、refetch、response validationのいずれかが失敗した場合は `changeLanguage` を呼ばず、localStorageも変更しない。error snackbarを表示し、controlled Selectは変更前の言語を示す。

これにより、DB更新失敗時のbrowser-only成功を防ぐ。DB update成功後のrefetchだけが失敗した場合、DB側は変更済みでもUIは未確認としてerrorを示す。次のquery/refetchまたはloginでaccount値を再取得して整合させる。成功notificationは出さない。

### 6. User-visible states and wording

既存のSelect fieldを保ち、新しい常設説明、button、Retry操作、layoutは追加しない。

| 状態 | Select | 言語表示 | notification |
| --- | --- | --- | --- |
| account取得中 | disabled | 起動時fallback | なし |
| account設定済み取得成功 | enabled | account値を適用 | なし |
| account未設定取得成功 | enabled | fallback維持 | なし |
| account取得失敗 | enabled | fallback維持 | error |
| 保存中 | disabled | 変更前の確定値 | なし |
| 保存成功 | enabled | confirmed account値 | success |
| 保存失敗 | enabled | 変更前の確定値 | error |

主要文言:

| key | English | 日本語 |
| --- | --- | --- |
| `language.loadError` | Could not load your saved language. You can keep using this device's language. | 保存済みの言語を読み込めませんでした。この端末の言語で引き続き利用できます。 |
| `language.saveSuccess` | Language preference saved. | 言語設定を保存しました。 |
| `language.saveError` | Could not save the language. Your previous language is still active. | 言語設定を保存できませんでした。以前の言語を使用します。 |

notificationは既存Snackbarのsuccess/errorを使い、色だけで状態を示さない。save successは `changeLanguage` 完了後に表示し、新しい言語の翻訳を使う。

## 変更対象

### API / canonical rule

- `apps/api/supabase/migrations/20260802000000_add_user_language.sql`: column、check、column grant、trigger更新。
- `docs/harness/domain/user.md`: name+language契約とlanguageの意味。

### Web contract / feature

- `apps/web/src/types/database.types.ts`: users language型。
- `apps/web/src/features/preferences/languagePreference/**`: schema、query key、fetch/update、hooks、global sync componentとtests。
- `apps/web/src/features/preferences/appearanceSettings/LanguageSelect/LanguageSelect.tsx`: account mutation、disabled、notification。
- `apps/web/src/features/preferences/appearanceSettings/LanguageSelect/LanguageSelect.stories.tsx`: 通常状態に加え、遅延handlerとplayで保存中状態を確認できるStory。
- `apps/web/src/features/preferences/appearanceSettings/AppearanceSettings/AppearanceSettings.test.tsx`: account save success/failureとtheme非回帰。
- `apps/web/src/features/preferences/index.ts`: app Provider向けsync componentの公開。
- `apps/web/src/app/Provider.tsx`: global syncをSnackbar境界内へ追加。
- `apps/web/src/i18n/resources.ts`: load/save success/errorの英日文言。

### Test API boundary

- `apps/web/src/test/msw/handlers/profile.ts`: users responseへnullable languageを追加し、nameまたはlanguageのPATCHをstatefulに反映してselect responseを返す。汎用filter解釈は追加しない。
- fetch/update integration tests: select column、auth_user_id filter、body、response cardinality、不正値、errorを直接検証する。

既存profile fetch/schemaにはlanguageを追加しない。Account Informationが利用しない値をprofile formの責務へ混ぜない。

## テスト方針

| Requirements | Test |
| --- | --- |
| AC-1, AC-8 | update integration: language body、auth_user_id filter、single response一致。不一致/0件/errorは失敗。 |
| AC-2 | `LanguagePreferenceSync.test.tsx`: account値がlocal値より優先され、i18n/localStorageへmirrorされる。 |
| AC-3, AC-4 | sync test: account nullで有効local値または既定値を維持し、PATCHしない。 |
| AC-5 | sync test: GET errorでもchildrenまたはtest markerを維持し、fallback言語とload error snackbarを確認。 |
| AC-6 | AppearanceSettings test: PATCH error、refetch errorでSelect/localStorageが変更前のまま、successを表示しない。 |
| AC-7 | migration diffでcolumn grantがname/languageだけであることを確認。Web update APIがlanguage以外を送らない。 |
| AC-9 | migrationにdefault/backfill updateがなく、existing rowがnullになることを確認。 |
| AC-10 | Database型、schema、fetch/update、MSW request/response、domain.userの同期を各testとdiffで確認。 |
| AC-11 | AppearanceSettings既存testでtheme、英日表示、locale切替を維持。全Web verification batchを実行。 |

API通信を伴うテストはMSWと実際のcomponent操作を通す。handlerがquery/filterの正しさを代行せず、test側でURL search params、select column、auth_user_id、PATCH bodyを検証する。stateful mockはPATCH後のGETへlanguageを反映する用途に限定する。

LanguageSelect component Storyはカタログ・状態確認用でありPage storyではないため `browser-test` tagを追加しない。既存Page storyやStorybook browser-test対象を変更しないため、`web:test:storybook` は必須batchに追加しない。

## 採用しない案

| 案 | 採用しない理由 |
| --- | --- |
| `localStorage` をaccount source of truthのまま同期する | 別端末同期と「browserだけに分散させない」制約を満たさない。 |
| login時にlocal/browser localeをDBへbackfillする | 既存ユーザーの値を推測して保存する禁止に反する。 |
| `profile` queryへlanguageを追加してAppearanceから利用する | Account Informationのname/email責務とpreferencesの言語ユースケースを結合する。 |
| SupabaseSessionProvider内でlanguageを取得する | preference取得失敗をauth失敗・sign-outへ誤って拡大しやすい。 |
| optimisticにi18n/localStorageを変更して失敗時に補償する | browser-only片成功とcache/sourceの競合を増やす。DB確認後の適用で要件を直接満たせる。 |
| query cacheを `setQueryData` で更新する | source of truth再取得を省略し、Query Cache Policyに反する。 |
| language専用RPCを追加する | 単一行・単一列updateで既存PostgREST/RLS境界が成立し、追加API境界が不要。 |
| Retry buttonや常設statusを追加する | Requirementsにない新しい操作・レイアウトを追加するため。 |

## 既存挙動への影響

- 初期描画は従来どおりlocalStorage/defaultで開始し、authenticated account取得後に保存済み値があれば切り替わる。
- 明示的な言語選択はDB確認後に反映されるため、従来の即時localStorage変更からpendingを伴うaccount保存へ変わる。
- language取得失敗はauth statusやRouter描画を失敗させない。
- ThemeSelect、profile name/email、Auth方式、設定routeは変更しない。
- account未設定の既存ユーザーは現在の端末言語を維持し、選択保存時に初めてaccount値を持つ。

## リスクと確認事項

- 初期fallbackからaccount値への短い言語切替は発生し得る。account取得でアプリ全体をblockしないRequirementsを優先し、今回の設計では許容する。
- DB update成功後にrefetch失敗した場合、DBと現在UIが一時的に異なる。成功を表示せず、次回取得で収束させる。自動補償updateは追加しない。
- snackbar文言は表示時点のi18n言語を使う。save successだけはconfirmed language適用後に翻訳する。
- users REST handlerはprofileとlanguageの共通endpointを再現するため両bodyを扱うが、feature業務ロジックやfilter解釈は持たせない。
- migration専用commandは定義されていない。Build / VerifyではSQL contractのdiff確認とWeb境界の型・integration testsを証拠にする。

## Build / Verify手順

1. migration、domain.user、Database型を同じname/language契約へ更新する。
2. languagePreferenceのschema、fetch/update、query/mutation hooksを実装し、integration testsを追加する。
3. global sync componentを実装してProviderへ接続し、unset/success/errorをtestする。
4. LanguageSelectをaccount saveへ接続し、resources、MSW handler、Story、AppearanceSettings testsを同期する。
5. requirements.mdとdesign-doc.mdをread-onlyのまま差分・AC対応を監査する。
6. repository rootで `pnpm run web:format` を実行する。
7. `pnpm run web:lint`、`pnpm run web:format-check`、`pnpm run web:typecheck`、`pnpm run web:test:unit-integration` を同じbatchで実行する。

## Verification

Design / Planはdocumentation-onlyのためapplication commandsを実行しない。次を手動確認する。

- RequirementsのAC-1〜AC-11が実装境界とtestへ対応している。
- account/local/default、unset/load failure/save failureの状態遷移が一意である。
- name/language以外の権限、対応言語、theme、未認証account設定を広げていない。
- DB、canonical rule、generated type、API、React Query、i18n、MSWの責務が接続されている。
- 新しいユーザー操作は追加せず、既存LanguageSelectの選択操作だけをaccount保存へ変更している。
- requirements.mdを変更せず、design-doc.mdだけがDesign成果物として追加されている。

## Stop条件

- `public.users.language`以外の保存先、`name` / `language`以外の列権限が必要になる。
- 本人行1件のPostgREST updateと既存RLSで成立せず、新しいAuth方式・権限モデル・複数table transactionが必要になる。
- 対応言語、翻訳方針、theme、未認証ユーザーのaccount設定、navigationを変更する必要がある。
- 保存成否を確定するためにRequirementsにないRetry、確認、取消、画面遷移が必要になる。
- Designと異なるsource of truth、cache更新、optimistic behaviorが必要になる。
- verification failureが今回の変更と無関係で、工程内で解消できない。
