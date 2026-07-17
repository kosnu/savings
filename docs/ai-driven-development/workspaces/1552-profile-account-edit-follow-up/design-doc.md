---
title: "Design Doc: プロフィール情報表示・編集のフォローアップ"
doc_type: design
status: draft
area: web
applies_to:
  - apps/web
topics:
  - ai-driven-development
  - design
  - profile
  - settings
  - user
  - auth
  - accessibility
  - async-state
---

# Design Doc: プロフィール情報表示・編集のフォローアップ

## Goal

[Requirements / PRD](./requirements.md) に従い、Issue #1552のプロフィール画面で、保存結果の確定境界、取得失敗からの復帰、既存の言語設定との共存、ログイン方法のprovider fallbackを実装可能な設計へ落とし込む。

Requirementsはread-onlyの入力とし、email変更、ログイン方法変更、アカウント削除、言語設定の仕様変更、DB/API/Auth/権限/RLS変更は扱わない。

## Inputs

- Issue: #1552「プロフィールで登録情報を確認・編集できるようにする」
- Requirements: `docs/ai-driven-development/workspaces/1552-profile-account-edit-follow-up/requirements.md`
- 既存のプロフィール機能は影響範囲の確認にのみ参照し、Requirementsにない既存挙動を仕様の根拠にしない。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `apps/web/**`
  - domain: `user`, `auth`, `web`
  - activity: `design_screen`, `change_form`, `change_user_behavior`, `change_query`, `change_mutation`, `review_test_gap`
  - topic: `user`, `auth`, `ui`, `react-query`, `test`, `error-boundary`, `accessibility`
- Selected nodes:
  - `domain.user` -> `docs/harness/domain/user.md`: Auth userとアプリ内ユーザーの責務、表示名更新の成功判定を守る。
  - `web.design-system-brand` -> `DESIGN.md`: 落ち着いた視覚トーンと主要なユーザー向け表現を守る。
  - `web.design-rules` -> `apps/web/docs/policies/design-rules.md`: フォーム、状態、操作群、responsive、button variantを決める。
  - `web.component-structure` -> `apps/web/docs/policies/component-structure.md`: 新しいcomponentを追加・分割する場合の配置を決める。
  - `web.query-cache` -> `apps/web/docs/policies/query-cache.md`: mutation後の再取得成功と完了表示の責務を分ける。
  - `web.test-policy` -> `apps/web/docs/policies/test-policy.md`: 受け入れ条件に対応する回帰テストを定義する。
  - `web.suspense-boundaries` -> `apps/web/docs/policies/suspense-boundaries.md`: loading/errorとRetry復帰の境界を決める。
- Depends-on nodes: `web.suspense-boundaries`の`web.query-cache` / `web.test-policy`は上記選択済み。追加の依存文書はない。
- Conflict decision: none。

## Scope

### 変更対象

- `apps/web/src/features/profile/profileSettings/AccountInformation/AccountInformation.tsx`
  - 保存・取得状態、ErrorBoundary内のRetry、focus、provider表示、操作群配置を調整する。
- `apps/web/src/features/profile/profileSettings/useUpdateDisplayName.ts`
  - 更新成功、source of truth再取得、再取得失敗のPromise境界を調整する。
- `apps/web/src/features/profile/profileSettings/updateDisplayName.ts`
  - 認証中ユーザーに対応する1件の更新確認を行う。
- `apps/web/src/features/profile/profileSettings/ProfileSettings/ProfileSettings.tsx`
  - AccountInformationとLanguageSelectの状態境界を維持し、必要なアクセシビリティ接続だけを追加する。
- `apps/web/src/features/profile/profileSettings/AccountInformation/AccountInformation.test.tsx`
  - 保存・Retry・provider fallbackのユーザー向け回帰を追加・更新する。
- `apps/web/src/features/profile/profileSettings/ProfileSettings/ProfileSettings.test.tsx`
  - loading/error中もLanguageSelectが使えることを画面合成で確認する。必要な場合だけ新規作成する。
- `apps/web/src/features/profile/profileSettings/updateDisplayName.integration.test.ts`
  - 更新対象の絞り込みと1件確認をAPI境界で確認する。
- `apps/web/src/test/msw/handlers/profile.ts`
  - 再取得失敗・更新応答を再現する最小限のテスト設定を追加する。handler内でquery条件の正しさを検証しない。
- `apps/web/src/i18n/resources.ts`
  - 保存未確定、provider不明など、Designで決めた主要文言を英語・日本語で追加・更新する。

### 対象外

- Requirements / PRD、既存のRequirements / Design Docの編集。
- DB schema、Supabase RLS、API契約、認証方式・設定、権限モデルの変更。
- 新規依存の追加。
- email、provider、Auth metadataの更新操作。
- 言語設定の保存方式・仕様変更。
- プロフィール画面全体の再設計や、今回の受け入れ条件にない共通化。

## 採用する設計

### 1. 状態境界と責務

`ProfileSettings`はAccountInformationとLanguageSelectを兄弟の縦積みとして維持する。プロフィール情報のSuspense fallbackとErrorBoundaryはAccountInformation領域だけに置き、LanguageSelectを含む親をboundaryで包まない。

状態と責務は次のように分ける。

| 状態 | AccountInformation | LanguageSelect |
| --- | --- | --- |
| profile loading | skeletonを表示。値を確定値として見せない | 操作可能 |
| profile error | alertとRetryを表示 | 操作可能 |
| profile resolved | 表示名フォーム、email、ログイン方法を表示 | 操作可能 |
| name saving | 入力とSaveをdisabled/loading。draftは保持 | 操作可能 |
| save succeeded and refetched | 再取得した表示名を表示し、success snackbar | 操作可能 |
| save succeeded but refetch failed | フォーム内save error。成功通知なし。draftを保持 | 操作可能 |

プロフィールのloading/errorはLanguageSelectの操作可能性を変更しない。ProfileSettings全体を一つのloading/error画面へ置き換えない。

### 2. 表示名の保存境界

表示名保存は、次の順序を一つのユーザー操作として扱う。

1. 入力をvalidationし、変更がある場合だけ更新を開始する。
2. `auth_user_id`で対象を絞り、`name`だけを更新する。
3. 更新応答で認証中ユーザーに対応する1件が更新されたことを確認する。0件または一意性に反する応答は失敗とする。
4. profile queryをsource of truthから再取得する。query cacheの直接差し替えやoptimistic updateは行わない。
5. 再取得が成功した場合だけ、mutationを成功完了として返し、フォームを再取得値へ同期してsuccess snackbarを表示する。
6. 更新後の再取得が失敗した場合はPromiseをrejectし、フォームのsave errorへ伝える。success snackbarは表示せず、入力draftを保持する。

`invalidateQueries`の完了だけを成功条件にしない。再取得エラーが呼び出し元へ伝播する明示的なrefetch境界を採用する。再取得成功前にキャッシュへ新しいnameを直接書き込まない。

### 3. 取得失敗とRetryのfocus

AccountInformationのErrorBoundary fallbackは、Retry操作を持つ局所的なerror stateとする。

- Retry開始時はRetryをloading / disabledにし、多重再試行を防ぐ。
- Retryはprofile queryを再取得し、成功した場合だけErrorBoundaryをresetする。
- Retryが失敗した場合はfallbackを維持し、Retryへfocusを戻す。
- Retryが成功してfallbackが消える場合は、Account informationの見出しへfocusを移し、ユーザーが復帰した領域と次の操作を把握できるようにする。見出しはプログラムからfocus可能だが、通常のTab順には入れない。
- focus移動は画面全体のscrollを不必要に変えない。

ErrorBoundaryのresetは再取得完了後に行い、query key変更だけで復帰すると仮定しない。初回error中もLanguageSelectはfallbackの外側に残る。

### 4. Providerの表示解決

ログイン方法表示用の純粋な解決処理を用意し、認証設定やsessionを変更しない。

1. `app_metadata.provider` が空でない文字列なら第一候補にする。
2. 第一候補がない場合、`identities[0].provider` が空でない文字列ならfallbackにする。
3. providerがGoogleなら既存のGoogle表示へ変換する。
4. 両方に有効な値がない、または対応する表示名がない場合は、ログイン方法を確認できない読み取り専用状態を表示する。profile全体をerrorにせず、email・表示名・LanguageSelectの利用は継続する。

provider不明状態では認証方法変更や再認証の操作を追加しない。ユーザー向けには「ログイン方法を確認できません。」相当の中立的な補助文言を表示し、存在しないprovider名を表示しない。

### 5. Domain Value UI Decisions

| 値 | 主に見せるもの | UI判断 |
| --- | --- | --- |
| 表示名 | 値と編集可能状態 | ラベル付きtext input。変更時だけSaveを有効化し、保存中はdisabled/loading。 |
| email | 識別情報としての値 | 読み取り専用のkey-value。inputや保存操作にしない。 |
| login method / provider | 識別情報としての値または確認不能状態 | 読み取り専用のkey-value。既知providerは名称、不明時は補助文言。 |
| loading / error / 未確定 | 状態と次の操作 | loadingはskeleton、取得errorはalert + Retry、save errorはフォームalert、成功は一時通知。 |

emailとproviderは編集可能な入力群と視覚的に区別するが、値の意味を増やす説明や複数のprovider情報を並べて混乱させない。

### 6. Web UIと主要文言

- プロフィール画面は1列の縦読みを基本にし、モバイルでも表示順と操作順を変えない。
- section間は既存のページ縦積み、field間は`gap="3"`、本文と操作群は`space-4`相当、button間は`gap="3"`を使う。
- Saveは主操作のsolid variant、Retryは二次操作のsoft variantとする。
- Settingsの視線が上から下へ直線的に進むことを優先し、Save操作群は左寄せにする。これは画面文脈による既定からの差分であり、Design Docに理由を残す。
- Save・Retryは処理中にspinnerを表示し、実際にdisabledにする。
- 主要文言は次の意味を固定する。翻訳は英語・日本語を用意する。
  - 保存成功: 「表示名を更新しました。」
  - 保存未確定 / 失敗: 「表示名を保存できませんでした。」相当。再取得失敗も成功通知ではなくこのsave errorへ集約する。
  - 取得失敗: 「プロフィール情報を読み込めませんでした。」相当。
  - Retry: 「もう一度試す」相当。
  - provider不明: 「ログイン方法を確認できません。」相当。
- 失敗は赤いalertまたはフォームalertで示し、色だけに依存しない。provider不明はデータ欠落であり、認証失敗とは区別して中立的な補助表示にする。

### 7. Component / module boundary

既存のAccountInformationディレクトリ構造を維持し、薄いwrapperのための新しい共通componentは追加しない。

- provider解決のようなUIでない処理は、同じfeature slice内のutilityとして切り出してよい。
- 新しいcomponentを切り出す必要がある場合は、AccountInformation配下にファイルを追加せず、`profileSettings`直下の兄弟componentディレクトリと`index.ts`を作る。
- `index.ts`は同じcomponent実装だけを再exportし、hook・utility・schemaを再exportしない。

## 不採用案と理由

| 案 | 不採用理由 |
| --- | --- |
| mutation成功直後にsuccess snackbarを出し、invalidationだけを待つ | source of truthの再取得失敗を成功と誤認するため。 |
| query cacheへ新しいnameを直接setして即時成功表示する | cacheを業務状態の保存先にし、source of truthとの不整合を隠すため。 |
| ProfileSettings全体をSuspense / ErrorBoundaryで包む | loading/error中にLanguageSelectも使えなくなり、Requirementsに反するため。 |
| Retry失敗時にfallbackをresetする | 失敗した状態を復帰成功と誤認し、次のRetry操作を失わせるため。 |
| provider不明をprofile全体の取得errorにする | 表示できないproviderだけの問題で、他のプロフィール値と言語設定まで利用不能にするため。 |
| 既存の右寄せをそのまま維持する | Settingsでは視線の縦方向の流れを優先するというRequirements / Design判断に反するため。 |
| 汎用ProfileCardや共通AsyncSectionを新設する | 今回のスコープを超え、薄い抽象化を増やすため。 |

## 影響範囲とテスト方針

### Unit / integration

- `updateDisplayName.integration.test.ts`: `auth_user_id`で対象を絞り、request bodyが`name`だけであること、更新対象1件を確認することをAPI境界で検証する。
- `AccountInformation.test.tsx`: 保存中のinput/Save disabled、mutation成功後の再取得失敗でsuccess snackbarが出ないこと・draftが保持されること、Retry成功/失敗のfocus、provider fallbackとprovider不明を検証する。
- `ProfileSettings.test.tsx`: profile loading中とerror中にLanguageSelectのtriggerが利用できることを実際の画面合成で検証する。既存構造で同じ受け入れ条件を検証できる場合は既存テストへ統合する。
- `fetchProfile.integration.test.ts`: 既存のauth_user_id絞り込み・select検証を維持する。handlerにquery条件を複製しない。
- MSW handlerはGETの初回成功後の再取得失敗、PATCH成功後のGET失敗、更新応答の0件相当を再現できる最小設定だけ追加する。filter/query条件の正しさはテスト側で検証する。

### Acceptance Criteria mapping

| Requirements | Design / test |
| --- | --- |
| AC-1〜AC-3 | update境界、refetch `throwOnError`、保存成功通知、対象1件のintegration test |
| AC-4 | mutation中のinput/Save disabled test |
| AC-5 | Retry pending、失敗時button focus、成功時heading focus test |
| AC-6〜AC-7 | ProfileSettings画面合成でLanguageSelect操作 test |
| AC-8〜AC-9 | metadata優先、identity fallback、provider不明表示 test |
| AC-10〜AC-11 | 変更対象とrule-map照合、scope review |

## 既存挙動への影響

- プロフィール取得失敗時はAccountInformation領域だけがerror表示になり、LanguageSelectは利用可能になる。
- Saveのsuccess snackbarは、PATCH成功時ではなくPATCH後のprofile再取得成功時に限定される。
- provider情報を解決できない場合でも、プロフィール画面全体は利用可能なまま、login methodだけを確認不能として表示する。
- Save操作群はSettingsの視線の流れに合わせて左寄せになる。
- email、ログイン方法の編集操作、言語設定の仕様、Auth/DBの責務は変わらない。

## リスクと確認事項

- React Queryの再取得失敗をmutationの呼び出し元へ伝播しつつ、フォームdraftを維持できる境界を実装前に確認する。既存APIで実現できない場合はStopする。
- Retry成功時に見出しへfocusを移す際、画面内の読み順とスクロール位置を壊さないことを確認する。
- `identities[0]`以外のidentityを検索する仕様は追加しない。複数identityの扱いが必要になった場合はStopする。
- provider表示文言やsave error文言の追加が翻訳資産の範囲を超える場合は、既存の文言方針と整合を確認する。
- 新規componentや共通化が必要になった場合は、component-structure policyに従う。対象範囲が広がる場合はStopする。

## Verification

この成果物はdocumentation-onlyのDesign Docであり、アプリのformat、lint、typecheck、testは実行しない。次を手動確認する。

- RequirementsのAC、対象外、制約、Q&AとDesign判断が対応している。
- 保存、Retry、LanguageSelect、provider fallbackの状態遷移とテスト方針が一貫している。
- Domain Value UI Decisions、Typography、spacing、button variant、responsive、主要文言がselected Web UI rulesと整合している。
- `domain.user`、`web.query-cache`、`web.suspense-boundaries`、`web.test-policy`、`web.component-structure`に違反していない。
- 既存のRequirements / Design Docを変更していない。
- `git diff --check`が成功する。

## Stop条件

- Requirementsにないプロダクト判断、対象機能、成功条件を追加する必要がある。
- DB/API/Auth/権限/RLS変更、新規依存、複数データ更新のトランザクション境界が必要になる。
- React Queryの再取得失敗を成功通知へ伝播させない設計とdraft保持を両立できない。
- Retryのfocus、LanguageSelectとのloading/error共存、provider表示の意図が一意に決められない。
- Design DocがRequirementsまたはselected rule-map subgraphに違反する、または違反の可能性を解消できない。
