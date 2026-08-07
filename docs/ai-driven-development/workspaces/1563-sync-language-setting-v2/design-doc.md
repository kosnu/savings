---
title: "Design Doc: 言語取得を行うStoryのAPI通信を分離する"
doc_type: design
status: draft
area: web
applies_to:
  - docs/ai-driven-development
  - apps/web/src/app/routes/SettingsPage
topics:
  - ai-driven-development
  - design
  - storybook
  - browser-test
  - msw
  - language
when_to_read:
  - Issue #1563 の言語取得を含むStoryを変更するとき
  - SettingsPageのbrowser-test Storyが依存するAPI境界を確認するとき
---

# Design Doc: 言語取得を行うStoryのAPI通信を分離する

## 目的

[Requirements](./requirements.md)をread-only入力とし、言語取得を行う`SettingsPage.Appearance` Storyがusers API境界をMSW内で完結させ、未処理requestのbypass、実Supabase、外部通信、偶発的な取得失敗へ依存しない状態にする。

このDesignではStoryのテスト環境だけを変更する。production code、DB/API/Auth/RLS、ユーザー向け表示・操作、共通MSW handlerの契約は変更しない。

## Current Stateと原因境界

- `SettingsPage.stories.tsx`はPage Storyであり、全Storyが`browser-test`対象である。
- Storybook previewは認証済みsessionとQueryClientを提供し、未処理requestを`bypass`する。
- `Appearance`が描画する`LanguageSelect`は、認証済みユーザーIDで`useLanguagePreference`を実行し、`/rest/v1/users`へGETする。
- `Appearance`にはusers API handlerがなく、言語取得がStoryのMSW境界を越える。
- 同じファイルの`Profile`と`ProfileRetryFailed`は、必要な状態に応じて`createProfileHandlers()`を各Storyへ局所設定している。
- `Default`と`BookManagement`はusers APIを必要としないため、全Story共通の依存ではない。

不足しているのは`Appearance`固有のusers GET境界であり、productionの言語取得実装やhandler factoryの機能ではない。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `apps/web/src/app/routes/SettingsPage/SettingsPage.stories.tsx`, `docs/ai-driven-development/**`
  - domain: `web`, `test`, `user`
  - activity: `change_storybook_browser_test`, `test_api_interaction`
  - topic: `storybook`, `browser-test`, `msw`, `language`
- Selected nodes:
  - `ai-driven.workflow` -> `docs/ai-driven-development/workflow.md`: DesignとBuildのartifact境界を守るため。
  - `documentation.policy` -> `docs/harness/policies/documentation-policy.md`: Design Docのfront matterと責務を守るため。
  - `domain.user` -> `docs/harness/domain/user.md`: `public.users.language`の正本境界を確認するため。
  - `web.storybook-browser-tests` -> `apps/web/docs/policies/storybook-browser-tests.md`: API通信Storyの全境界再現と最小配置を適用するため。
  - `web.msw-handlers` -> `apps/web/docs/policies/msw-handlers.md`: 既存factoryの代表正常系をAPI境界として再利用するため。
- Depends-on nodes:
  - `ai-driven.overview` -> `docs/ai-driven-development/overview.md`。
  - `web.test-policy` -> `apps/web/docs/policies/test-policy.md`。
  - `web.suspense-boundaries` -> `apps/web/docs/policies/suspense-boundaries.md`。
  - `web.query-cache` -> `apps/web/docs/policies/query-cache.md`。
- Conflict decision: none。

## 採用する設計

### `Appearance` Storyへusers API handlerを局所設定する

`SettingsPage.stories.tsx`の`Appearance`へ次のStory parametersを追加する。

```ts
parameters: {
  msw: {
    handlers: createProfileHandlers(),
  },
},
```

- 既に同ファイルでimportされている`createProfileHandlers`を再利用する。
- factoryの既定GET responseは`language: null`を返し、既存のAppearance Storyが表す通常状態を維持する。
- handlerはAPI境界を必要とする`Appearance`だけへ置く。
- Storyのplay、UI文言、args、router、providerは変更しない。
- handler factory、共通preview、未処理request設定は変更しない。

## 責務分離

| 境界 | 所有する責務 | 今回変更しない責務 |
| --- | --- | --- |
| `Appearance` Story | 描画に必要なusers API正常系を局所的に提供する | productionの取得・保存挙動 |
| `createProfileHandlers` | users GET/PATCHの代表的response shapeを再現する | Story固有の配置判断 |
| Storybook preview | 共通provider、認証session、auth handlerを提供する | 一部Storyだけが使うusers handler |
| `Appearance` play | 言語・テーマの正常表示を確認する | handler内部や外部通信の実装詳細 |

## Requirements・受け入れ条件との対応

| Requirements | 設計・検証 |
| --- | --- |
| AC-5、AC-9 | 既存のlanguage query実装と回帰テストを変更せず、Web unit/integration batchで維持する。 |
| AC-10 | Web全検証で既存言語表示と保存値の回帰がないことを確認する。 |
| AC-12 | `Appearance`へ`createProfileHandlers()`を設定し、Storybook browser testを実行する。 |

Story自身が`browser-test`対象であるため、新しいテストファイルは追加しない。変更後のStorybook browser testを回帰証拠とする。

## 採用しない案

| 案 | 理由 |
| --- | --- |
| 共通previewへprofile handlerを追加する | `Default`と`BookManagement`はusers APIへ依存せず、最小配置のルールに反する。 |
| `LanguageSelect`のqueryをStoryで無効化する | productionと異なる経路を作り、API境界の欠落を隠す。 |
| 未処理requestのbypassを成功条件にする | 実API・外部通信・偶発的失敗へ依存し、AC-12を満たさない。 |
| profile handler factoryを変更する | 既存factoryは必要な正常系をすでに提供しており、変更理由がない。 |
| 新しい専用handlerを作る | users endpointの既存handlerと責務が重複する。 |

## 既存挙動への影響

- production runtime、言語のDB正本、取得・保存、初期登録、端末間同期は変わらない。
- Storybookの`Appearance`は、従来と同じ英語・Lightの正常表示を、外部通信なしで再現する。
- `Profile`、`ProfileRetryFailed`、他のSettingsPage Storyのhandlerと表示は変わらない。
- ユーザー向け操作や文言は追加・変更・削除しない。

## リスクと確認事項

- Story-level parametersがpreviewのauth handlerと併用されることは、同ファイルの既存StoryパターンおよびStorybook browser testで確認する。
- `createProfileHandlers()`はGETとPATCHの両方を返すが、既存factoryの再利用単位であり、新しいAPI責務は追加しない。
- `Appearance`のplayは未処理request自体を直接assertしないため、handler配置の差分監査とbrowser test成功を組み合わせて確認する。

## Build / Verify手順

1. `SettingsPage.stories.tsx`の`Appearance`へ既存`createProfileHandlers()`を局所設定する。
2. RequirementsとDesign Docをread-onlyのまま、実装差分がAC-12とselected rulesに一致することを確認する。
3. repository rootで`pnpm run web:format`を実行する。
4. `pnpm run web:lint`、`pnpm run web:format-check`、`pnpm run web:typecheck`、`pnpm run web:test:unit-integration`を同じbatchで実行する。
5. browser-test対象Storyの変更として`pnpm run web:test:storybook`を実行する。
6. `git diff --check`とscope監査を行う。

## Verification

Designはdocumentation-onlyのためapplication commandを実行しない。

- RequirementsのAC-12と採用設計・検証が一対一で対応する。
- current cycleのRequirementsを変更していない。
- production、共通preview、handler factory、ユーザー操作を変更対象にしていない。
- selected ruleと設計判断が整合する。
- `git diff --check`が成功する。

## Stop条件

- `Appearance`への局所handlerだけではAPI通信を分離できない。
- 共通preview、handler factory、production code、DB/API/Auth/RLSを変更する必要がある。
- 新しいユーザー向け操作・文言またはRequirementsにない成功条件が必要になる。
- 他のStoryへ想定外の影響が広がる。
- Requirementsまたはselected ruleと矛盾する。
