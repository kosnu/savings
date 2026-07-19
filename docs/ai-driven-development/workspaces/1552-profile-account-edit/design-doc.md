---
title: "Design Doc: プロフィールで登録情報を確認・編集できるようにする"
doc_type: design
status: draft
area: repository
applies_to:
  - docs/ai-driven-development
  - apps/web
topics:
  - ai-driven-development
  - design-doc
  - profile
  - settings
  - user
  - auth
  - forms
when_to_read:
  - Issue #1552 のプロフィール機能を実装するとき
  - Auth user とアプリ内ユーザーの責務、プロフィール更新境界を確認するとき
---

# Design Doc: プロフィールで登録情報を確認・編集できるようにする

## 1. 目的と入力

Issue #1552 と、次の Requirements / PRD を実装方針へ展開する。

- Requirements: `docs/ai-driven-development/workspaces/1552-profile-account-edit/requirements.md`
- Issue: https://github.com/kosnu/savings/issues/1552

Requirements は read-only の source of truth とする。表示名だけを編集可能にし、email とログイン方法を読み取り専用にする。既存の言語設定を維持し、DB schema、API 契約、Auth 方式・設定、RLS、権限モデルは変更しない。

## 2. Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `apps/web/src/features/profile/**`, `apps/web/src/providers/supabase/**`, `apps/web/src/test/**`
  - domain: `user`, `auth`, `web-ui`
  - activity: `design_screen`, `change_form`, `change_query`, `change_mutation`, `add_component`, `add_test`
  - topic: `profile`, `settings`, `domain-ui`, `react-query`, `loading`, `error`, `test`
- Selected:
  - `ai-driven.workflow` -> `docs/ai-driven-development/workflow.md`: Design Doc の責務と Requirements read-only 境界。
  - `architecture.overview` -> `docs/architecture.md`: Web と Supabase の役割分担。
  - `infrastructure.overview` -> `docs/infrastructure.md`: Supabase Auth / PostgreSQL の前提。
  - `domain.user` -> `docs/harness/domain/user.md`: Auth user、アプリ内 user、`name`、email、`auth_user_id` の責務。
  - `policy.transaction-boundaries` -> `docs/harness/policies/transaction-boundaries.md`: 表示名保存の操作境界。
  - `web.design-system-brand` -> `DESIGN.md`: Savings の視覚トーン。
  - `web.design-rules` -> `apps/web/docs/policies/design-rules.md`: フォーム、状態、文字階層、responsive。
  - `web.domain-ui-rules` -> `apps/web/docs/policies/domain-ui-rules.md`: 値、状態、識別情報の主表示。
  - `web.component-structure` -> `apps/web/docs/policies/component-structure.md`、`web.feature-directory` -> `apps/web/docs/policies/feature-directory.md`: feature / component 配置。
  - `web.query-cache` -> `apps/web/docs/policies/query-cache.md`、`web.suspense-boundaries` -> `apps/web/docs/policies/suspense-boundaries.md`: query、mutation、再取得、loading/error。
  - `web.test-policy` -> `apps/web/docs/policies/test-policy.md`: ユーザーに残る状態の回帰テスト。
- Depends-on:
  - `ai-driven.overview` -> `docs/ai-driven-development/overview.md`（workflowの前提）。
  - `architecture.overview`（infrastructure / transaction の前提）。
  - `web.design-system-brand`、`web.design-rules`、`domain.amount`、`domain.date`（domain-ui-rulesの前提）。amount/dateは本件では変更しない。
  - `web.component-structure`（feature-directoryの前提）、`web.query-cache` / `web.test-policy`（suspense-boundariesの前提）。
- Conflict decision: none。

## 3. Current State と既存パターン

- `/settings/profile` は `ProfileSettings` を表示し、現在は `LanguageSelect` だけを持つ。
- `SupabaseSessionProvider` は Auth session を保持し、`session.user.id` と Auth user の情報を利用できる。
- 現行サインインは `signInWithOAuth({ provider: "google" })` である。プロフィールではこのログイン方法を変更しない。
- `public.users` は `auth_user_id` で Auth user と対応し、`name` と `email` を保持する。RLS は自分の行だけを読み書きでき、DB権限は `name` の更新だけを許可している。
- Web の取得は Supabase client の `from(...).select(...)` を feature slice の fetch 関数から行い、React Query の `useQuery` が query key と promise を提供する既存パターンがある。
- 非同期表示は `ErrorBoundary`、`Suspense`、query promise、Skeleton の組み合わせが既存パターンである。
- 更新は `useMutation` と feature 固有の更新関数を使い、成功後は `invalidateQueries` / refetch で source of truth から再取得する。手動の cache 書き換えはしない。
- Settings Page story は `browser-test` tag 付きで、Profile story が既存の Language 表示を確認している。

## 4. 採用方針

### 4.1 データの責務と取得元

表示するプロフィール値は `public.users` の現在ユーザー行から取得する。

- `name`: `public.users.name`。アプリ内の表示用プロフィール値であり、保存対象。
- email: `public.users.email`。プロフィール画面で表示する登録メールアドレスの単一 source of truth とし、`session.user.email` を別値として併記しない。
- ログイン方法: Auth session の `session.user.app_metadata.provider` を優先し、値がなければ `session.user.identities[0].provider` を使う。現在の `google` は `Google` として表示する。
- `auth_user_id`: `public.users` の RLS と Auth user の対応付けに使う内部値であり、UIには表示しない。

email変更は対象外であり、Auth user email と `public.users.email` を同期する処理も追加しない。既存の同期前提に反して値が一致しない場合に新しい同期処理を追加するのではなく、プロフィール情報を確定表示できないエラーとして扱い、Build / Verify で Stop する。

### 4.2 Query と mutation

新しい API、RPC、DB migration は追加せず、既存の Supabase client と RLS を使う。

- `profileQueryKeys.current(authUserId)` を `['profile', 'current', authUserId]` として追加する。
- `fetchProfile` は `public.users` から `name,email` だけを select し、RLSで認証ユーザー自身の行に限定する。0件、複数件、response shape不正、Supabase errorは取得エラーにする。
- `useProfile` は既存の `useQuery` + `query.promise` パターンを使い、auth user ID を query key に含めて session 切り替え時の値混入を防ぐ。
- `updateDisplayName` は `public.users` の `name` だけを更新する。`auth_user_id` は現在 session の user ID で filter し、更新対象を自分の行に限定する。
- `useUpdateDisplayName` は `useMutation` を使い、成功後に current profile query を invalidate して再取得する。optimistic update と `setQueryData` は採用しない。
- 保存は `name` の1行更新だけで、Auth user metadata、email、権限、他テーブルを同じ操作単位に含めない。したがって新しい transaction / RPC は不要である。

### 4.3 UI構造と配置

既存の `profileSettings` slice を拡張し、汎用の shared component や薄い wrapper は追加しない。

- `ProfileSettings` は `AccountInformation` と既存の Language section を縦に構成する。Language section は profile query の失敗境界の外側に置き、アカウント情報の取得失敗でも言語設定を使えるようにする。
- `AccountInformation` は account information の見出し、プロフィール query の `ErrorBoundary` / `Suspense`、成功時のフォームを担当する。
- 成功時は1つのフォーム内で、表示名を editable text field、email とログイン方法を read-only の key-value value として表示する。email / login method を disabled input にせず、入力可能なフィールドと混同させない。
- 表示順は、主な編集対象である表示名、アカウント識別情報である email、認証文脈であるログイン方法の順にする。言語設定は別 section として後に置く。
- 表示名のフォームは既存の `useForm`、`FieldLabel`、`FieldMessages`、`SubmitButton` のパターンを使う。保存中は入力と Save を無効化し、保存失敗時は入力値を保持する。
- 既存の component structure に従い、追加する公開 component は `AccountInformation/AccountInformation.tsx` と同ディレクトリの `index.ts` にする。query、fetch、mutation、schema は component directory ではなく `profileSettings` slice の目的別ファイルに置く。

### 4.4 Domain Value UI Decisions

| 値 | 利用目的 | 主に見せるもの | 表示・状態の決定 |
| --- | --- | --- | --- |
| 表示名 | 実値を確認し、自分の表示名を変更する | 値 + editable state | text field と Save。保存中、保存成功、保存失敗を分ける。 |
| email | 現在のアカウントを識別する | 値 + read-only state | `public.users.email` の値を key-value 表示。入力にはしない。 |
| ログイン方法 | 認証方法を識別する | 値 + read-only state | `Google` などの provider label。追加・変更操作は置かない。 |
| auth_user_id | 内部対応付けを確認する | UIには出さない | Auth userとDB rowの境界でのみ使う。 |
| loading / error / success | 確定値か、操作可能か、結果が完了したかを判断する | 状態 | 値と別階層で表示し、失敗を成功に見せない。比較元、baseline、期間は表示しない。 |

### 4.5 Loading、error、保存結果

- loading: Account information section内に、見出しと3項目の関係を保つ Skeleton を表示する。Language sectionは利用可能なままにする。
- load error: `ErrorBoundary` の `Callout` / `role="alert"` に「プロフィール情報を読み込めませんでした。」相当の文言と Retry 操作を表示する。Retryは該当 query を reset / invalidate して再取得する。
- save error: フォーム上部の `Callout` / `role="alert"` に「表示名を保存できませんでした。」相当の文言を表示し、入力値を保持する。入力変更時にエラーを消す。
- save success: `SnackbarProvider` の success notification で「表示名を更新しました。」相当の文言を表示し、query refetch 後の値をフォームに反映する。
- providerが解決できない場合は、推測した provider名や `Unknown` を成功値として表示せず、プロフィール情報の取得エラーとして扱う。

### 4.6 Major copy と responsive

追加・更新する翻訳キーは英語・日本語を同時に定義する。

| 用途 | English | 日本語 |
| --- | --- | --- |
| account section | Account information | アカウント情報 |
| display name | Display name | 表示名 |
| email | Email address | メールアドレス |
| login method | Login method | ログイン方法 |
| read-only indicator | Read-only | 読み取り専用 |
| load error | Could not load profile information. | プロフィール情報を読み込めませんでした。 |
| save error | Could not save your display name. | 表示名を保存できませんでした。 |
| save success | Display name updated. | 表示名を更新しました。 |
| retry | Try again | もう一度試す |

Settings overview の Profile description は、言語設定だけを示さない「プロフィール情報と言語を管理します。」相当へ更新する。レイアウトはモバイル1列を基本とし、既存の spacing token、文字階層、Radix propsを使う。読み取り専用の補助情報は主値より弱くし、エラーは色だけで表現しない。

## 5. 変更対象ファイルと責務

### 変更または追加候補

- `apps/web/src/features/profile/profileSettings/ProfileSettings/ProfileSettings.tsx`: Account information と Language section のページ構成。
- `apps/web/src/features/profile/profileSettings/AccountInformation/AccountInformation.tsx`、`index.ts`: query境界、Skeleton、error、成功時フォームのUI。
- `apps/web/src/features/profile/profileSettings/fetchProfile.ts`: `public.users` の `name,email` 取得とresponse validation。
- `apps/web/src/features/profile/profileSettings/useProfile.ts`: profile query key、query、promise。
- `apps/web/src/features/profile/profileSettings/updateDisplayName.ts`: `name` だけの更新。
- `apps/web/src/features/profile/profileSettings/useUpdateDisplayName.ts`: mutationとprofile query invalidation。
- `apps/web/src/features/profile/profileSettings/profileQueryKeys.ts`: current profile query key。
- `apps/web/src/i18n/resources.ts`: 英語・日本語のprofile/settings/error/success文言。
- `apps/web/src/test/msw/handlers/profile.ts`: profile GET/PATCH境界の代表レスポンスとerror option。必要なテストが決まった時点で追加する。
- `apps/web/src/test/data/supabaseSession.ts`: providerが解決できるGoogleのsession fixture。
- `apps/web/src/features/profile/profileSettings/AccountInformation/AccountInformation.test.tsx`: 正常、read-only、loading、load error、save、save error。
- `apps/web/src/features/profile/profileSettings/fetchProfile.integration.test.ts`、`updateDisplayName.integration.test.ts`: request shapeとresponse/error境界。
- `apps/web/src/app/routes/SettingsPage/SettingsPage.test.tsx`: Language維持、Profile section、overview descriptionの回帰。
- `apps/web/src/app/routes/SettingsPage/SettingsPage.stories.tsx`: browser-test Page storyのProfile状態と主要操作。

### 採用しない案

- Auth user metadata の `name` を更新する: `name` は `public.users.name` の表示用プロフィール値であり、Auth metadata変更はRequirementsの更新境界を超える。
- emailをAuth userと`public.users`の両方から表示する: 同じ意味の値を重複表示し、責務差をユーザーへ持ち込む。
- profile専用のAPI/RPCを追加する: 既存のSupabase table accessとRLSで実現でき、DB/API変更はStop条件である。
- React Query cacheをmutation成功時に直接書き換える: source of truthとの不整合を避けるため、invalidate/refetchを使う。
- 汎用のUserProfile componentを`apps/web/src/components`へ追加する: 現時点ではprofile feature内だけの用途であり、shared component化は不要である。

## 6. Acceptance Criteria とテスト方針

| Requirements | Design / test evidence |
| --- | --- |
| AC-1, AC-2 | AccountInformationの正常系でname、email、providerを表示し、nameだけtextbox/Saveとして確認する。 |
| AC-3 | stateful MSW handlerでPATCH後のGETが更新値を返し、成功通知と再取得後の値を確認する。PATCH errorではalert、入力保持、成功通知なしを確認する。 |
| AC-4, AC-5 | email/providerをinputやbuttonとして扱わず、read-only表示と主要文言を確認する。 |
| AC-6, AC-7 | GET delay/error、provider欠落、PATCH pending/errorを確認し、古い値・別ユーザー値・推測値を成功表示しないことを確認する。 |
| AC-8 | Settings Page test/storyでLanguage comboboxが引き続き表示・操作できること、Profile descriptionが更新されることを確認する。 |
| AC-9, AC-10 | request bodyが`name`だけであること、Auth metadataやDB schema/API/RLS変更がないことをコードレビューで確認する。 |

MSW handlerは実際のREST request境界を再現し、業務ロジックをmockへ複製しない。PATCH後の再GETを検証するケースだけstateful responseを使い、他は固定responseとerror optionを使う。`SettingsPage.stories.tsx` は `browser-test` tag付きPage storyのため、変更後はStorybook browser testをWeb verification batchに追加する。

## 7. 既存挙動への影響とリスク

- `/settings/profile` のroute、Settings shell、LanguageSelectの保存方法は変更しない。
- Settings overviewのProfile descriptionだけは、プロフィール機能追加を反映して変更する。
- profile query失敗をAccount information section内に閉じ込め、Language sectionを利用不能にしない。
- RLSが自分の行を返さない、Auth userとapp userの対応付けがない、emailが空、providerが解決できない場合は、別値を補完せずerrorにする。
- emailのAuth/app user間不一致を修復する同期処理は実装しない。実データで不一致が確認された場合はBuild / VerifyでStopする。
- 保存成功後のquery refetchが失敗した場合、保存成功通知と古い表示が同時に誤解を生まないよう、更新結果の扱いをBuild / Verifyで確認する。必要なら保存成功を表示する前にinvalidate/refetch完了を待つ。

## 8. Build / Verify への引き渡し

- `requirements.md` と本 `design-doc.md` をread-only入力として実装する。
- Web verification batch（`AGENTS.md`記載のformat、lint、format-check、typecheck、unit/integration test）を実行する。
- `SettingsPage.stories.tsx`、`apps/web/.storybook-test/`、browser-test設定を変更した場合は `pnpm run web:test:storybook` も実行する。
- test failure、型エラー、request shape不一致、query invalidation漏れ、Language回帰はBuild / Verify内で解消する。

## 9. Stop条件

- DB schema、API契約、Auth方式/設定、RLS、権限モデルの変更が必要になる。
- Auth userと`public.users`のemail責務・表示元を既存仕様だけで決められない、または不一致修復が必要になる。
- 複数データ更新のtransaction boundary、保存成功/再取得失敗のユーザー結果にRequirements外の仕様判断が必要になる。
- Requirementsにない機能、主要文言、成功条件、UI目的を追加する必要がある。
- selected rule-map subgraphに矛盾があり、Design Docがルール・ポリシーに違反する可能性を解消できない。
