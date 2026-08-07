---
title: Storybook Browser Tests
doc_type: policy
status: accepted
area: web
applies_to:
  - apps/web
topics:
  - storybook
  - browser-test
  - vitest
when_to_read:
  - Storybookのブラウザテスト対象を変更するとき
  - component storyを追加または変更するとき
  - Page storyを追加または変更するとき
  - StoryがAPI通信を行うとき
  - `pnpm --filter web test:storybook` の対象範囲を確認するとき
---

# Storybook Browser Tests

Storybook のブラウザテストは opt-in で運用します。

コンポーネントに Story を作成する条件は `apps/web/docs/policies/component-structure.md` で定義します。そこで作成対象になった component Story も、以下の条件に該当しない限り browser test の対象にはしません。

`pnpm --filter web test:storybook --reporter=dot --silent` の Storybook project は `apps/web/.storybook-test/` の Storybook 設定を使い、`apps/web/src/app/routes/**/*.stories.tsx` 配下の Page story だけを読み込みます。その上で、`browser-test` tag が付いた story だけを対象にします。

Web の通常検証では Storybook browser test を常時実行しません。`browser-test` 対象の story、`apps/web/.storybook-test/`、または Storybook browser-test 設定を変更した場合に実行します。

ブラウザ実行はコストが高いため、Storybook 上の全 story を網羅するのではなく、ページ単位または統合境界をまたぐ story に絞ります。

## 対象にする story

- Page コンポーネントの story
- Router、QueryClient、MSW、Theme など複数 provider をまたぐ story
- Dialog、Popover、Portal、focus trap などブラウザ寄りの挙動を含むページ級 story
- ブラウザ上での表示または操作確認に明確な価値がある story

## 対象にしない story

- Button、Field、Input、Card などの leaf component のカタログ用途 story
- 同名の `.test.tsx` で挙動を十分確認している component story
- props の見た目違いを並べるだけの story

## 追加ルール

Storybook test project の収集範囲は、Story の責務を Page へ移す理由にしません。子コンポーネントが所有する状態は、そのコンポーネント自身の Story に定義し、browser test で実行するためだけに Page Story へ重複して定義してはいけません。現行の収集範囲に含まれない component Story はカタログ用途として扱い、browser test の対象にする必要がある場合は、収集範囲の変更を別途判断します。

新しい Page story を追加するときは、meta の `tags` に `browser-test` を付けます。

```ts
const meta = {
  title: "Pages/ExamplePage",
  component: ExamplePage,
  tags: ["autodocs", "browser-test"],
} satisfies Meta<typeof ExamplePage>
```

Page 以外の story に `browser-test` を付ける場合は、ブラウザテスト対象にする理由が story の責務から読み取れるようにしてください。

## API通信の分離

API通信を行うStoryは、表示または操作に必要なすべてのAPI境界をMSW handlerで再現します。Story内のコンポーネントだけでなく、共通providerやdecoratorから発生するAPI通信も対象に含めます。

- 未処理requestのbypass、実APIの可用性、外部通信、偶発的な失敗状態に依存してStoryやbrowser testを成立させません。
- handlerは、API境界を必要とする最小のStoryまたはStoryグループへ設定します。
- すべてのStoryが同じAPI境界へ依存する場合だけ、共通decoratorまたはpreviewへhandlerを置きます。
- handlerのresponseやfactory optionは、`apps/web/docs/policies/msw-handlers.md`に従います。

通常の Storybook は `apps/web/.storybook/` を使い、カタログ用途として全 story を読み込みます。`apps/web/.storybook-test/` は Storybook test project 専用で、テスト実行時の読み込み負荷を抑えるために Page story へ限定します。

## 関連ポリシー

- `apps/web/docs/policies/test-policy.md`
- `apps/web/docs/policies/msw-handlers.md`
