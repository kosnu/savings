---
title: Profile Account Information Component Boundaries Design
doc_type: design
status: draft
area: web
applies_to:
  - apps/web/src/features/profile
topics:
  - profile
  - component-boundary
  - storybook
  - test
when_to_read:
  - Issue #1552のAccount Informationの責務分離を実装するとき
  - Account Informationのcomponent StoryとStory再利用テストを変更するとき
---

# Profile Account Information Component Boundaries Design

## Artifact Premise

このDesign Docは、[requirements.md](./requirements.md)のFR-1〜2、NFR-1〜5、AC-1〜8を実現するための実装方針を定義する。Requirementsはread-onlyの入力であり、このDesignで追記、修正、整形、renameしない。

今回の変更は、Issue #1552で定義済みのプロフィール表示・編集体験を、責務に沿ったコンポーネント境界、独立したStory、Storyを基準にしたテストへ整理するものである。新しいユーザー操作、ドメイン値、DB、API、認証、権限を追加しない。

## Goal

- Account Informationのデータ取得責務と表示名フォーム責務を分ける。
- 独立したstateまたはactionを持つユーザー向け責務を、同じfeature slice内の兄弟コンポーネントとして配置する。
- Account Information自身と切り出したコンポーネントに、責務と主要状態を単独で確認できるStoryを用意する。
- コンポーネントテストを原則Storyから構成し、Requirementsの受け入れ条件へ対応付ける。

## Non-Goals

- プロフィールの表示項目、編集可能範囲、文言、API契約の変更
- 言語設定、Retry focus、provider fallbackの仕様変更
- Storybook browser test対象の拡大
- profile feature外への共通コンポーネント化
- Storyやテスト専用のpropsを本番コンポーネントへ追加すること
- 薄い描画断片を行数だけで別コンポーネントへ分割すること

## Current Implementation Inventory

| 現在のファイル | 現在の責務 | Design上の扱い |
| --- | --- | --- |
| `AccountInformation/AccountInformation.tsx` | session、query、Suspense、ErrorBoundary、retry、フォーム、read-only表示、loading/error表示、provider解決 | データ境界を残し、独立責務を兄弟コンポーネントへ移す |
| `AccountInformation/AccountInformation.test.tsx` | 表示、保存、loading/error/retry、provider fallbackを直接renderで検証 | Story再利用を前提に責務別testへ分割 |
| `ProfileSettings/ProfileSettings.tsx` | Account InformationとLanguageSelectの統合 | 統合境界を維持 |
| `ProfileSettings/ProfileSettings.test.tsx` | Account Informationのloading/error中もLanguageSelectが操作可能か検証 | ProfileSettings Storyを基準に維持 |
| `SettingsPage/SettingsPage.stories.tsx` | Page/router/provider統合と`browser-test` | Page Storyとして維持。component Storyの代替にしない |
| `test/msw/handlers/profile.ts` | profile GET/PATCHの正常、error、delay、stateful更新 | 既存factoryを再利用し、原則変更しない |

## Adopted Component Boundaries

### Responsibility and State Ownership

| 境界 | 所有する責務・state/action | 配置判断 | Story |
| --- | --- | --- | --- |
| `AccountInformation` | sessionからの対象決定、section heading、query/Suspense/ErrorBoundary、retry成功後のheading focus | 公開コンポーネントとして現在のディレクトリに残す | 必須 |
| `AccountInformationContent` | query promiseの解決、更新hook、login method解決、Formへのproduction callback接続 | 独立したUI、local state、user actionを持たないdata bridgeなので`AccountInformation.tsx`内のprivate componentに残す | 不要。親Storyで確認 |
| `AccountInformationForm` | 表示名入力、validation、save callback実行、pending表示、保存成功通知、保存error、email/login methodのread-only表示 | 独立したフォーム責務を持つため、同じsliceの兄弟コンポーネントへ切り出す | 必須 |
| `ReadOnlyProfileValue` | label、value、read-only補助文言の反復描画 | state/actionを持たない薄い描画断片なので`AccountInformationForm.tsx`内のprivate componentに残す | 不要。Form Storyで確認 |
| `ProfileLoading` | Suspense fallbackのskeleton描画 | state/actionを管理しないfallback断片なので`AccountInformation.tsx`内のprivate componentに残す | 不要。AccountInformationのLoading Storyで確認 |
| `ProfileLoadError` | error表示、retryのpending、多重操作防止、retry失敗時のbutton focus | 独立したstate/actionを持つため、同じsliceの兄弟コンポーネントへ切り出す | 必須 |
| `getLoginMethod` | session metadata/identityから表示用providerを解決 | UIコンポーネントではないAccount Information固有のpure helperとして親実装内に残す | 対象外 |
| `ProfileSettings` | Account InformationとLanguageSelectの同時利用 | AC-8の統合境界として維持 | 既存testのStory再利用のため追加 |

### Directory Structure

```text
profileSettings/
  AccountInformation/
    AccountInformation.tsx
    AccountInformation.stories.tsx
    AccountInformation.test.tsx
    index.ts
  AccountInformationForm/
    AccountInformationForm.tsx
    AccountInformationForm.stories.tsx
    AccountInformationForm.test.tsx
    index.ts
  ProfileLoadError/
    ProfileLoadError.tsx
    ProfileLoadError.stories.tsx
    ProfileLoadError.test.tsx
    index.ts
  ProfileSettings/
    ProfileSettings.tsx
    ProfileSettings.stories.tsx
    ProfileSettings.test.tsx
    index.ts
```

`AccountInformation`は`../AccountInformationForm`と`../ProfileLoadError`からimportする。親ディレクトリ配下に子コンポーネントを置かない。各`index.ts`は同じディレクトリの同名コンポーネントだけを公開する。profile feature外への公開面は変更しない。

## Data and Interaction Flow

1. `AccountInformation`が認証sessionから`authUserId`を取得する。
2. `AccountInformationContent`が`useProfile`のpromiseを解決する。pendingは親の`Suspense`、errorは親の`ErrorBoundary`へ委ねる。
3. `AccountInformationContent`が`useUpdateDisplayName(authUserId)`を呼び、解決した`Profile`、表示用`loginMethod`、`updateDisplayName` callback、`isPending`を`AccountInformationForm`へ渡す。
4. Formが表示名をvalidationしてcallbackを実行する。callbackはmutationとquery再取得を完了してからresolveし、Formはresolve後に成功通知、reject時に保存errorを表示する。
5. 再取得で更新後profileが解決すると、親がprofile名をkeyとしてForm stateをサーバー値へ同期する現在の境界を維持する。
6. load errorでは`ProfileLoadError`がretry中stateを所有する。親から渡された`onRetry`がquery refetchとErrorBoundary resetを行い、成功後は親がsection headingへfocusを移す。失敗時は`ProfileLoadError`がRetry buttonへfocusを戻す。

query cacheを直接更新しない。既存のrefetchとsource of truth境界を維持する。

## Component API Decisions

### AccountInformationForm

公開propsは本番責務に必要な次の値だけとする。

- `profile: Profile`
- `loginMethod: "google" | "unavailable"`
- `isPending: boolean`
- `onSaveDisplayName: (name: string) => Promise<void>`

`onSaveDisplayName`と`isPending`はtest専用ではなく、data containerとFormを分けるproduction APIである。Formは入力・validation・callbackの実行と結果表示を所有し、親はauth userとserver/query境界を所有する。submit errorを外部注入するtest-only propsは追加しない。

### ProfileLoadError

公開propは`onRetry: () => Promise<void> | void`だけとする。retry pendingとfocus管理はコンポーネント内部に残し、呼び出し側はquery refetch/ErrorBoundary resetだけを担当する。

## Story Design

すべて通常のStorybookカタログ用とし、metaには`tags: ["autodocs"]`を設定する。`browser-test`は付けない。Page/router統合、複数provider横断は既存`SettingsPage` Storyが担当し、component Storyは各責務を単独で確認する。

### AccountInformation Stories

| Story | Setup | 確認する状態 |
| --- | --- | --- |
| `Default` | authenticated session、通常profile handler | heading、表示名、email、Google、read-only表示、Save |
| `Loading` | GETを`durationOrMode: "infinite"` | section headingとskeleton。LanguageSelectはこのStoryの対象外 |
| `LoadError` | GET error | load errorとRetry導線 |
| `IdentityProviderFallback` | app metadataなし、Google identityありのsession、通常GET | identity provider fallbackでGoogleを表示 |
| `UnavailableLoginMethod` | providerを解決できないsession、通常GET | profile全体を失敗させずunavailableを表示 |

`errorOnce`によるretry復帰は静的カタログ状態ではなく、`LoadError`をfixtureとしてAccountInformation testで操作検証する。

### AccountInformationForm Stories

| Story | Setup / play | 確認する状態 |
| --- | --- | --- |
| `Default` | 通常profile、Google、resolved save callback | 通常フォームとread-only値 |
| `UnavailableLoginMethod` | `loginMethod="unavailable"` | login methodの不明状態 |
| `ValidationError` | playで表示名を空にしてSave | field errorとaria属性 |
| `Saving` | `isPending=true`、変更後のprofile値 | input/Save disabledとspinner |
| `SaveError` | rejected save callback、playで値変更後Save | 入力値保持とform alert |
| `Saved` | resolved save callback、playで値変更後Save | success snackbar |

Form Storyはserver/queryを擬似再現せず、production callbackのresolve/reject契約からFormが所有する表示を確認する。callbackがsource of truth再取得まで待つことと、再取得後の値反映はAccountInformationのintegration testで確認する。

### ProfileLoadError Stories

| Story | Setup / play | 確認する状態 |
| --- | --- | --- |
| `Default` | resolved `onRetry` | errorとRetry button |
| `Retrying` | unresolved `onRetry`を渡しplayでclick | button disabled、spinner、`aria-busy` |
| `RetryFailed` | rejected `onRetry`を渡しplayでclick | Retry buttonへのfocus復帰 |

### ProfileSettings Stories

| Story | Setup | 確認する状態 |
| --- | --- | --- |
| `Default` | 通常profile handler | Account InformationとLanguageSelectの共存 |
| `ProfileLoading` | GET infinite | profile loading中もLanguageSelectを操作可能 |
| `ProfileError` | GET error | profile error中もLanguageSelectを操作可能 |

### Provider and MSW Boundary

- Story fileのdecoratorに、そのcomponentが必要とするQueryClient、Supabase session、Theme、Snackbarだけを置く。FormはQueryClient/MSWを必要とせず、SnackbarとThemeだけを持つ。`composeStories`でtestへ持ち込める境界にする。
- AccountInformationとProfileSettingsはauthenticated sessionをStory側で明示する。provider差分はStory単位のdecoratorで上書きする。
- AccountInformationとProfileSettingsのAPI状態は既存`createProfileHandlers`の`get`/`update` optionsで表す。FormとProfileLoadErrorはcallback argsで状態を表し、MSWを持たない。
- mutation後の2回目GETだけ失敗させる順序依存ケースは、test内の局所handlerでrequest countを検査する。MSW factoryへ汎用的な業務順序を追加しない。
- Storyのargs、provider、初期値をtest側へ再定義しない。test固有のAPI順序だけを局所handlerで上書きする。

## Test Design

各component testは`@storybook/react-vite`の`composeStories`から対象Storyを取得してrenderする。Story decoratorがproviderを持つため、test utilityは`withProviders: false`で二重providerを避ける。直接`<AccountInformation />`、`<AccountInformationForm />`、`<ProfileLoadError />`、`<ProfileSettings />`をrenderするテストは作らない。

### AccountInformation.test.tsx

- `Default`: 表示名、email、login method、read-only、保存成功後の再取得値、success通知。
- `Default`＋PATCH delay: 実際のmutation中にFormへpendingが伝わり、inputとSaveがdisabledになる。
- `Default`＋PATCH error: update失敗がForm errorとして表示され、入力とsuccess通知の境界を維持する。
- `Default`＋2回目GET error: PATCH成功後のrefetch失敗をerrorとして扱い、入力保持、success通知なし。
- `LoadError`: `errorOnce` handlerへ上書きし、Retry復帰とheading focusを検証。
- `LoadError`: 常時errorへ上書きし、再失敗時の責務はProfileLoadError testで検証。
- `Loading`: skeleton。
- `UnavailableLoginMethod`: provider不明でもprofileを表示。
- `IdentityProviderFallback`: app metadataがない場合にidentity providerからGoogleを表示。
- `UnavailableLoginMethod`: providerを解決できなくてもprofile全体をerrorにしない。

### AccountInformationForm.test.tsx

- `Default`: 初期値とread-only表示。
- `ValidationError`: validation text、`aria-invalid`、accessible description。
- `Saving`: `isPending` contractによりinputとSave disabled、spinner。
- `SaveError`: callback reject時の入力保持、alert、success通知なし。
- `Saved`: success通知。再取得値の反映は親testへ重複させない。

### ProfileLoadError.test.tsx

- `Default`: Retry callbackを1回だけ呼ぶ。
- `Retrying`: disabled、spinner、`aria-busy`。
- `RetryFailed`: callback reject後にRetry buttonへfocusを戻し、再操作可能になる。

### ProfileSettings.test.tsx

- `ProfileLoading`: LanguageSelectがenabled。
- `ProfileError`: alert表示中もLanguageSelectがenabled。

### Existing Non-Component Tests

`fetchProfile.integration.test.ts`と`updateDisplayName.integration.test.ts`はAPI関数のintegration testであり、component Story再利用の対象外として維持する。直接componentを使わないため例外コメントは不要。

## Domain Value UI Decisions

| 値 | 利用目的 | UIで主に見せるもの | 状態・補助情報 |
| --- | --- | --- | --- |
| 表示名 | 現在値を確認し変更する | label付きTextFieldの値 | validationは入力直下、save errorはform alert、成功はsnackbar |
| email | ログイン中アカウントを識別する | 値そのもの | TextFieldにせずread-only補助文言を添える |
| ログイン方法 | 認証方法を理解する | Googleまたは利用不可という識別情報 | TextFieldにせずread-only補助文言を添える |

比較元、基準値、許可範囲、分類、期間は表示しない。値の順序は表示名、email、ログイン方法を維持する。

## UI, Responsive, and Copy Decisions

- Account InformationはSettings内のsectionとしてheading `size="4"`、1列の上から下への読み順を維持する。
- フォームは全体error、field群、操作群の順にする。field間`gap="3"`、本文と操作群`gap="4"`を維持する。
- Saveはsolidの主操作とし、Settingsで情報確認から保存まで視線を直線に保つため左寄せを維持する。
- loadingはskeleton、button内pendingはspinner、field errorは入力直下、load/save errorはalert、successはsnackbarにする。
- 送信中は表示名入力とSaveを実際にdisabledにし、多重送信を防ぐ。
- mobile/desktopとも1列で同じ読み順と操作順を使い、新しいbreakpoint分岐やCSSを追加しない。
- 次の既存翻訳keyと伝達内容を変更しない: `profile.accountInformation`, `profile.displayName`, `profile.email`, `profile.loginMethod`, `profile.readOnly`, `profile.providerUnavailable`, `profile.providers.google`, `profile.loadError`, `profile.retry`, `profile.saveError`, `profile.saveSuccess`, `common.save`。
- 新しいユーザー向け文言は追加しない。

## Files to Change

### Add

- `profileSettings/AccountInformation/AccountInformation.stories.tsx`
- `profileSettings/AccountInformationForm/AccountInformationForm.tsx`
- `profileSettings/AccountInformationForm/index.ts`
- `profileSettings/AccountInformationForm/AccountInformationForm.stories.tsx`
- `profileSettings/AccountInformationForm/AccountInformationForm.test.tsx`
- `profileSettings/ProfileLoadError/ProfileLoadError.tsx`
- `profileSettings/ProfileLoadError/index.ts`
- `profileSettings/ProfileLoadError/ProfileLoadError.stories.tsx`
- `profileSettings/ProfileLoadError/ProfileLoadError.test.tsx`
- `profileSettings/ProfileSettings/ProfileSettings.stories.tsx`

### Modify

- `profileSettings/AccountInformation/AccountInformation.tsx`
- `profileSettings/AccountInformation/AccountInformation.test.tsx`
- `profileSettings/ProfileSettings/ProfileSettings.test.tsx`

### No Planned Change

- `SettingsPage/SettingsPage.stories.tsx`
- `test/msw/handlers/profile.ts`
- profile query、mutation、schema、translation files
- API、DB、認証関連ファイル

Build中に既存handlerやtranslationの変更が必要になった場合は、Designとの差として理由を確認する。新しいプロダクト判断が必要ならStopする。

## Alternatives Not Chosen

### AccountInformation.tsx内にFormとErrorを残す

独立したフォームstate/actionとretry state/actionをprivate componentに残し、`web.component-structure`とNFR-1を満たさないため採用しない。

### すべてのprivate componentを切り出す

`AccountInformationContent`、`ProfileLoading`、`ReadOnlyProfileValue`は独立したstate/actionを持たない。薄いbridge/描画断片まで分けると境界が増えるだけなので採用しない。

### Page Storyだけを使う

Account Information、Form、Load Errorの責務を単独で確認できず、NFR-2とAC-4を満たさないため採用しない。

### component Storyへbrowser-testを付ける

各Storyはleaf/componentカタログ境界であり、Page/router統合は既存SettingsPage Storyが担当する。browser実行の価値が追加されないため採用しない。

### Form内部に更新hookを残す

Form単体ではactive profile queryがなく、Storyでsource of truth再取得契約を正しく表せない。data containerが本番のsave callbackとpendingを渡し、Formが入力・validation・結果表示を所有する境界の方が責務とStory fixtureを一致させられるため採用しない。

### Storyを使わず既存test helperだけを維持する

Storyとtestのargs/provider/初期状態が二重管理になり、NFR-3とAC-6を満たさないため採用しない。

## Implementation Sequence

1. `ProfileLoadError`を兄弟ディレクトリへ切り出し、StoryとStory再利用testを追加する。
2. `AccountInformationForm`を兄弟ディレクトリへ切り出し、Form Story行列と責務別testを追加する。
3. `AccountInformation`を新しい兄弟コンポーネントへ接続し、自身のStoryとintegration testをStory基準へ変更する。
4. `ProfileSettings` Storyを追加し、LanguageSelect独立性testをStory基準へ変更する。
5. 重複した旧testを削除し、AC対応表に沿って責務ごとの検証が1か所にあることを確認する。
6. AGENTS.mdのWeb verification batchを実行する。component Storyに`browser-test`を付けず、Page StoryやStorybook browser-test設定を変更しないため`web:test:storybook`は実行対象にしない。

## Acceptance Criteria and Verification Mapping

| AC | 実装境界 | 主なStory | 主なtest |
| --- | --- | --- | --- |
| AC-1 | AccountInformationForm | Form `Default`, `UnavailableLoginMethod` | Form initial/read-only、AccountInformation provider表示 |
| AC-2 | AccountInformation、Form、ProfileLoadError | Account `Loading`/`LoadError`、Form `ValidationError`/`Saving`/`SaveError`/`Saved` | 責務別component tests |
| AC-3 | AccountInformationForm、ProfileLoadErrorの兄弟配置 | 各component Story | import/責務分離と各test |
| AC-4 | AccountInformation、Form、ProfileLoadError | 各同名Story | 各testが`composeStories`を利用 |
| AC-5 | 各Story行列 | 通常＋所有する主要状態 | Story fixtureを使う状態test |
| AC-6 | 全component tests | composed stories | direct component renderがないことを確認 |
| AC-7 | component Story metas | `autodocs`のみ | `browser-test` tagがないことを確認 |
| AC-8 | ProfileSettings統合、既存API/domain境界 | ProfileSettings `Default`/`ProfileLoading`/`ProfileError` | LanguageSelect独立性、既存Web verification |

## Risks and Mitigations

- **provider二重化:** Story decoratorをfixtureの正本にし、testは`withProviders: false`でrenderする。Form StoryにはQueryClientを置かない。
- **Story playの非決定性:** AccountInformation/ProfileSettingsのpendingはinfinite handler、errorは固定error handlerを使う。Form/ProfileLoadErrorはcallback argsで決定的に表す。順序依存のrefetch失敗だけtest-local handlerに閉じる。
- **test重複:** 成功後の再取得値はAccountInformation、form状態はForm、retry focusはProfileLoadError、LanguageSelect独立性はProfileSettingsへ一意に割り当てる。
- **ErrorBoundary console出力:** load error testだけ既存と同様にconsole errorを局所的に抑制し、test終了時にrestoreする。
- **scope拡大:** query/mutation/MSW/translationに変更が必要になった場合、既存契約維持のための機械的変更か確認し、新しい仕様判断ならStopする。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `docs/ai-driven-development/workspaces/**`, implementation scope `apps/web/src/features/profile/**`
  - domain: `web`, `ui`, `test`, `user`
  - activity: `write_design_doc`, `change_form`, `change_feature_boundary`, `split_component_responsibility`, `add_component_story`, `change_test`
  - topic: `design-doc`, `profile`, `component-boundary`, `storybook`, `suspense`, `regression`
- Selected nodes:
  - `documentation.policy` -> `docs/harness/policies/documentation-policy.md`
  - `domain.user` -> `docs/harness/domain/user.md`
  - `web.design-system-brand` -> `DESIGN.md`
  - `web.design-rules` -> `apps/web/docs/policies/design-rules.md`
  - `web.feature-directory` -> `apps/web/docs/policies/feature-directory.md`
  - `web.component-structure` -> `apps/web/docs/policies/component-structure.md`
  - `web.suspense-boundaries` -> `apps/web/docs/policies/suspense-boundaries.md`
  - `web.test-policy` -> `apps/web/docs/policies/test-policy.md`
  - `web.msw-handlers` -> `apps/web/docs/policies/msw-handlers.md`
  - `web.storybook-browser-tests` -> `apps/web/docs/policies/storybook-browser-tests.md`
- Depends-on nodes:
  - `ai-driven.overview` -> `docs/ai-driven-development/overview.md`
  - `ai-driven.workflow` -> `docs/ai-driven-development/workflow.md`
  - `web.query-cache` -> `apps/web/docs/policies/query-cache.md`
  - `web.component-structure`, `web.test-policy`, `web.suspense-boundaries`: selected nodesとして併読済み
- Conflict decision: 競合なし。UI詳細は`web.design-rules`、component配置は`web.component-structure`、test fixtureは`web.test-policy`をそれぞれの責務で適用する。

## Verification

Design phaseではアプリコードを変更しないため、アプリverificationは実行しない。

- RequirementsのFR/NFR/ACとDesignの責務、Story、test対応を照合する。
- Requirementsが変更されていないことを確認する。
- Files to Changeがprofile featureと関連component Story/testに閉じていることを確認する。
- Design Docと選択rule-mapサブグラフに違反がないことを確認する。
- `git diff --check`とMarkdown text hygieneを実行する。
