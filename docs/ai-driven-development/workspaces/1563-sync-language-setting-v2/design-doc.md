---
title: "Design Doc: MSWエラー応答とテスト契約を分離する"
doc_type: design
status: draft
area: web
applies_to:
  - docs/ai-driven-development
  - apps/web/src/test/msw/handlers
  - apps/web/src/features/profile
  - apps/web/src/features/preferences
topics:
  - ai-driven-development
  - design
  - msw
  - test
  - profile
  - language
---

# Design Doc: MSWエラー応答とテスト契約を分離する

## 目的

[Requirements](./requirements.md)をread-only入力とし、表示名とlanguageが共有するusers endpoint handlerから操作固有のエラー文言を除き、API失敗の伝播とユーザー向け表示のテスト責務を分離する。production code、API契約、UI文言、ユーザー操作は変更しない。

## Current Stateと原因境界

- `createProfileHandlers`は表示名とlanguageの取得・更新で同じ`/rest/v1/users` handlerを共有する。
- PATCHの既定500 responseは`Failed to save display name.`であり、共有endpointではなく表示名操作に意味が固定されている。
- 表示名とlanguageのintegration testはいずれも、この生のresponse文言をthrow messageとして厳密比較している。
- applicationはこの生文言を解釈して分岐せず、各UIは既存のlocalized文言と失敗状態を表示する。
- 表示名とlanguageのUIテストは、保存失敗時の操作固有文言、入力・言語・`localStorage`の維持、成功通知を出さないことをすでに検証している。

したがって、共有fixtureの操作固有文言とintegration testの厳密比較が責務の食い違いである。productionの保存処理やUI表示を変更する根拠はない。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `apps/web/src/test/msw/handlers/**`, `apps/web/src/features/profile/**`, `apps/web/src/features/preferences/**`, `docs/ai-driven-development/**`
  - domain: `web`, `test`, `user`
  - activity: `change_msw_handler`, `test_api_interaction`, `change_test`
  - topic: `msw`, `test`, `profile`, `language`
- Selected nodes:
  - `ai-driven.workflow` -> `docs/ai-driven-development/workflow.md`: DesignとBuildのartifact境界を守るため。
  - `documentation.policy` -> `docs/harness/policies/documentation-policy.md`: Design Docの責務を守るため。
  - `domain.user` -> `docs/harness/domain/user.md`: 表示名とlanguageが共有するプロフィール更新境界を確認するため。
  - `web.msw-handlers` -> `apps/web/docs/policies/msw-handlers.md`: 共有handler、factory option、raw error contractの責務を適用するため。
  - `web.test-policy` -> `apps/web/docs/policies/test-policy.md`: API失敗とユーザー可視挙動の検証境界を確認するため。
- Depends-on nodes:
  - `ai-driven.overview` -> `docs/ai-driven-development/overview.md`。
  - `web.suspense-boundaries` -> `apps/web/docs/policies/suspense-boundaries.md`。
  - `web.query-cache` -> `apps/web/docs/policies/query-cache.md`。
- Conflict decision: none。

## 採用する設計

### 1. 共有PATCH handlerの既定エラーをendpoint中立にする

`createProfileHandlers({ update: { error: true } })`の既定responseを、status 500と`{ message: "Failed to update profile." }`にする。

- 表示名、languageのどちらにも依存しないプロフィール更新失敗として表現する。
- `errorResponse` optionはstatus 500で任意のAPI response bodyを返す既存責務のまま維持する。
- 表示名用・language用のoptionを追加しない。
- request bodyを見てエラー文言を分岐しない。
- 成功時のstateful更新、GET失敗mode、delayは変更しない。

### 2. integration testはAPI失敗の伝播だけを契約にする

次の2テストは、既定500 responseによって対象関数がrejectすることを`rejects.toThrow()`で確認する。

- `updateLanguagePreference.integration.test.ts`
- `updateDisplayName.integration.test.ts`

両関数とも生のerror messageを分類・表示契約として利用しないため、fixture文言を厳密比較しない。対象ID、更新値、0件、別対象、不一致などapplicationが解釈する値の検証は既存どおり維持する。

### 3. 操作固有の失敗表示は既存UIテストが所有する

- language UIは保存失敗時に言語と`localStorage`を維持し、言語固有の通知を表示して成功通知を出さないことを検証する。
- 表示名UIは保存失敗時に入力値を維持し、表示名固有のalertを表示して成功通知を出さないことを検証する。
- UI文言、translation resource、コンポーネント、Storyは変更しない。

## 責務分離

| 境界 | 所有する契約 | 所有しないもの |
| --- | --- | --- |
| 共通MSW handler | users PATCHの成功shape、500失敗、API response差分 | 操作固有のユーザー向け文言 |
| handler factory option | status 500で返すresponse body、delayなどAPI境界差分 | 表示名・language別のUI選択 |
| integration test | request条件、response解釈、reject伝播 | applicationが解釈しないfixture文言 |
| UI test | 操作固有の表示文言、保持状態、成功/失敗の区別 | MSW response bodyの内部文言 |

## 変更対象

- `apps/web/src/test/msw/handlers/profile.ts`: PATCH既定エラーをendpoint中立にする。
- `apps/web/src/features/preferences/languagePreference/updateLanguagePreference.integration.test.ts`: raw message依存を外す。
- `apps/web/src/features/profile/profileSettings/updateDisplayName.integration.test.ts`: 同じ共有fixture依存を外す。
- `docs/ai-driven-development/workspaces/1563-sync-language-setting-v2/design-doc.md`: 本設計。

## 対象外

- productionのprofile/language query、mutation、hook、component。
- i18n resourceとユーザー向け文言。
- DB migration、generated type、RLS、RPC、認証処理。
- handlerのsuccess response、stateful更新、GET error mode。
- `errorResponse` optionの削除、操作別optionの追加。
- 現在サイクルの`requirements.md`。

## テスト方針

| Requirements | 検証 |
| --- | --- |
| AC-6、AC-8 | language integrationの成功、対象ID・値不一致、0件テストを維持する。 |
| AC-9 | 共有500 responseでlanguage更新がrejectし、language UIが保存成功扱いしない既存テストを確認する。 |
| AC-10 | Webの全unit/integration batchで表示名、language、既存プロフィール経路の回帰を確認する。 |
| AC-11 | languageと表示名のintegration testが生文言へ依存せずrejectを確認し、各UI testが操作固有の表示と状態を確認する。 |

Build / Verifyでは、AGENTS.mdに従い`pnpm run web:format`後、`web:lint`、`web:format-check`、`web:typecheck`、`web:test:unit-integration`を同じbatchで実行する。browser-test tagged storyやStorybook設定は変更しないため、`web:test:storybook`は対象外とする。

## 採用しない案

| 案 | 理由 |
| --- | --- |
| languageだけ期待文言を変更する | 共有handlerが表示名固有のままで、endpoint中立性を満たさない。 |
| language用のerror optionを追加する | API差分ではなくUI操作名をfactoryへ持ち込み、再利用責務を分断する。 |
| request bodyでエラー文言を切り替える | mockがUI固有ロジックを実装することになる。 |
| integration testで中立文言を厳密比較する | applicationが解釈しないfixture内部値を新しい契約にしてしまう。 |
| UI文言やproduction error handlingを変更する | 既存UI testがRequirementsの失敗挙動を満たしており、今回の責務修正に不要。 |

## 既存挙動への影響

- production runtime、DB正本、保存・再取得、端末間同期、初期登録は変わらない。
- テストfixtureの500 response bodyだけが操作中立になる。
- 表示名とlanguageのintegration testは、実際に必要な失敗伝播だけを固定する。
- 操作固有のユーザー体験は既存UIテストで引き続き保護される。

## リスクと確認事項

- 共有handlerを使う他テストが生文言へ依存していないことは検索済みだが、Web全unit/integration batchで確認する。
- `errorResponse` optionの明示payloadを必要とする将来テストは維持できる。
- 新しいAPI response仕様を定義する変更ではなく、テストfixtureの既定値を実契約以上に固定しないための修正である。

## Verification

Designはdocumentation-onlyのためapplication commandを実行しない。

- RequirementsのAC-9〜AC-11とテスト方針を照合する。
- 現在サイクルのRequirementsを変更していないことを確認する。
- selected ruleと設計判断の整合を確認する。
- `git diff --check`を実行する。

## Stop条件

- 生のerror responseをapplicationが解釈することが判明する。
- production code、API契約、DB/Auth/RLS、UI文言またはユーザー操作の変更が必要になる。
- 共有handlerの他利用箇所が操作固有のresponseを外部契約として必要とする。
- Requirementsまたはselected ruleと矛盾する。
