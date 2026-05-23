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
  - Page storyを追加または変更するとき
  - pnpm --filter web test:storybookの対象範囲を確認するとき
---

# Storybook Browser Tests

Storybook のブラウザテストは opt-in で運用します。

`pnpm --filter web test:storybook` の Storybook project は `apps/web/.storybook-test/` の Storybook 設定を使い、`apps/web/src/app/routes/**/*.stories.tsx` 配下の Page story だけを読み込みます。その上で、`browser-test` tag が付いた story だけを対象にします。

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

新しい Page story を追加するときは、meta の `tags` に `browser-test` を付けます。

```ts
const meta = {
  title: "Pages/ExamplePage",
  component: ExamplePage,
  tags: ["autodocs", "browser-test"],
} satisfies Meta<typeof ExamplePage>
```

Page 以外の story に `browser-test` を付ける場合は、ブラウザテスト対象にする理由が story の責務から読み取れるようにしてください。

通常の Storybook は `apps/web/.storybook/` を使い、カタログ用途として全 story を読み込みます。`apps/web/.storybook-test/` は Storybook test project 専用で、テスト実行時の読み込み負荷を抑えるために Page story へ限定します。
