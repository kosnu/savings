---
title: Component Structure
doc_type: policy
status: accepted
area: web
applies_to:
  - apps/web/src/app/routes
  - apps/web/src/components
  - apps/web/src/features
topics:
  - component-structure
  - component-boundary
  - frontend-architecture
  - project-structure
  - storybook
when_to_read:
  - Webアプリにコンポーネントを追加するとき
  - Webアプリのコンポーネントを別ファイルへ切り出すとき
  - WebアプリのコンポーネントにStoryを追加するか判断するとき
  - features配下またはcomponents配下のコンポーネント配置を変更するとき
  - ルートに登録するコンポーネントの配置を判断するとき
---

# Component Structure

Webアプリのコンポーネント定義は、ディレクトリ単位で管理します。

単体の `Foo.tsx` をコンポーネント定義として追加せず、コンポーネント名のディレクトリを作り、その中に同名の実装ファイルと `index.ts` を置きます。

```text
Foo/
  Foo.tsx
  index.ts
  Foo.test.tsx      # 必要な場合
  Foo.stories.tsx   # 「Storyの作成条件」に該当する場合
```

## PageとFeatureの配置

URLのパスやRouterの `component` に登録されることだけを理由に、`app/routes/` へPageコンポーネントを追加してはいけません。配置は、ルーティングから呼ばれるかではなく、表示・操作の責務を所有する機能から決めます。

- featureが所有する設定画面やユースケースの表示は、そのfeatureのsliceに置きます。ルートからfeatureの公開面を通して直接使い、Pageを経由するためだけのラッパーを作りません。
- 設定の見出しや余白を付けて機能のフォームを表示するだけでは、独立したPageを作る理由になりません。同種の設定画面の配置と責務を比較して判断します。
- `app/routes/` は、アプリ全体のナビゲーションやページレイアウト、ルート固有の条件・取得境界、複数機能をページとして組み合わせるなど、featureとは別のページ責務を持つ場合に使います。設定領域内の構成と、アプリ側のページ構成を区別します。

Storyの分類も配置と責務に揃えます。featureのコンポーネントは、ルートへ直接登録していても `Features/...` とし、ページの枠やナビゲーションとの組み合わせを確認するStoryは `Pages/...` とします。Storyのtitleだけを変更して、実装の配置判断を済ませたことにはしません。

## 責務によるコンポーネントの切り出し

同じファイル内の private component は、親の表示を読みやすく分けるだけの薄い描画断片に限ります。

名前を持つ子コンポーネントが、親とは別のユーザー向け責務を持ち、次のいずれかを独立して管理する場合は、同じファイル内に定義せずコンポーネントとして切り出します。

- フォームの入力、validation、送信、送信結果
- loading、error、retry などの非同期状態
- Dialog、Popover、focus 管理などの操作境界

たとえば、親がデータ取得と Error Boundary を担当し、子がフォーム状態と保存操作を担当する場合、そのフォームは独立したコンポーネントです。同じ feature slice 内の兄弟コンポーネントディレクトリへ切り出します。

ファイルの行数だけを切り出し条件にしません。独立した状態や操作責務を持たない短い表示断片は、親ファイル内の private component のままで構いません。

## Feature内の配置

feature slice 内でフォームやフィールドなどのコンポーネントを分ける場合も、各コンポーネントは兄弟ディレクトリとして配置します。

```text
createExample/
  ExampleField/
    ExampleField.tsx
    index.ts
  CreateExampleForm/
    CreateExampleForm.tsx
    index.ts
```

`CreateExampleForm` から `ExampleField` を使う場合は、`../ExampleField` から import します。

## 禁止する配置

単体ファイルのコンポーネント定義は禁止します。

```text
createExample/
  ExampleField.tsx
```

親コンポーネントのディレクトリ配下に、子コンポーネントを定義することも禁止します。

```text
createExample/
  CreateExampleForm/
    CreateExampleForm.tsx
    ExampleField.tsx
```

```text
createExample/
  CreateExampleForm/
    CreateExampleForm.tsx
    ExampleField/
      ExampleField.tsx
      index.ts
```

コンポーネントを切り出すときは、親コンポーネント配下ではなく、同じ feature slice 内の兄弟コンポーネントディレクトリとして作成します。

## Storyの作成条件

次のコンポーネントには、同じディレクトリに同名の `Foo.stories.tsx` を作成します。

- Page コンポーネント
- export され、ユーザーが直接見る表示または操作を担当するコンポーネント
- 「責務によるコンポーネントの切り出し」に従って切り出したコンポーネント

Story は対象コンポーネント自体を `component` に指定し、少なくとも通常状態を定義します。loading、error、validation error、disabled、pending など、ユーザーが利用できる表示または操作が変わる主要な状態をそのコンポーネントが持つ場合は、それらも Story として定義します。

コンポーネントが所有するloading状態は、loading中に対象コンポーネントが何も表示せず `null` 相当になる場合もStoryを定義します。一時的な状態であることや、UIを表示しないことを理由にloading Storyを省略してはいけません。

Page Story から子コンポーネントが表示されていても、子コンポーネント自身の Story を作成したことにはなりません。各 Story は、対象コンポーネントの責務と状態を単独で確認できる境界にします。

Story の作成条件と Storybook browser test の対象条件は別です。component Story に `browser-test` tag を自動で付けず、`apps/web/docs/policies/storybook-browser-tests.md` の対象条件に従います。

## index.ts の扱い

コンポーネントディレクトリの `index.ts` は、そのコンポーネントの公開口として置きます。
`index.ts` で再エクスポートしてよいのは、同じディレクトリにある同名のコンポーネント実装ファイルだけです。

一方で、feature 直下の `index.ts` は `apps/web/docs/policies/feature-directory.md` で扱う feature の公開面であり、コンポーネントディレクトリの `index.ts` とは別のものです。
コンポーネントディレクトリの `index.ts` から provider、hook、utility、schema、adapter など、コンポーネント定義以外の実装を再エクスポートしてはいけません。

## 対象外

hooks、utilities、schema、adapter など、コンポーネントではない実装ファイルはこのルールの対象外です。既存の層の配置規約に従います。

レビューコメントで「別ファイルに切り出して」と指摘された場合も、単体ファイル化ではなく、このコンポーネント構造に従って切り出します。
