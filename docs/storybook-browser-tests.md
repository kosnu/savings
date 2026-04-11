# Storybook Browser Tests

Storybook のブラウザテストは opt-in で運用します。

`task web:test-storybook` は `browser-test` tag が付いた story だけを対象にします。ブラウザ実行はコストが高いため、Storybook 上の全 story を網羅するのではなく、ページ単位または統合境界をまたぐ story に絞ります。

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
