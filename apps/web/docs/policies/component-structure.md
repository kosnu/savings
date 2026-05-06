---
title: Component Structure
doc_type: policy
status: accepted
area: web
applies_to:
  - apps/web/src/components
  - apps/web/src/features
topics:
  - component-structure
  - frontend-architecture
  - project-structure
when_to_read:
  - Webアプリにコンポーネントを追加するとき
  - Webアプリのコンポーネントを別ファイルへ切り出すとき
  - features配下またはcomponents配下のコンポーネント配置を変更するとき
---

# Component Structure

Webアプリのコンポーネント定義は、ディレクトリ単位で管理します。

単体の `Foo.tsx` をコンポーネント定義として追加せず、コンポーネント名のディレクトリを作り、その中に同名の実装ファイルと `index.ts` を置きます。

```text
Foo/
  Foo.tsx
  index.ts
  Foo.test.tsx      # 必要な場合
  Foo.stories.tsx   # 必要な場合
```

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

## index.ts の扱い

コンポーネントディレクトリの `index.ts` は、そのコンポーネントの公開口として置きます。
`index.ts` で再エクスポートしてよいのは、同じディレクトリにある同名のコンポーネント実装ファイルだけです。

一方で、feature 直下の barrel export とは別の話です。コンポーネントディレクトリに `index.ts` を置くことを理由に、`features/<feature>/index.ts` や feature slice 直下の barrel export を追加してはいけません。
provider、hook、utility、schema、adapter など、コンポーネント定義以外の実装を `index.ts` から再エクスポートしてはいけません。

## 対象外

hooks、utilities、schema、adapter など、コンポーネントではない実装ファイルはこのルールの対象外です。既存の層の配置規約に従います。

レビューコメントで「別ファイルに切り出して」と指摘された場合も、単体ファイル化ではなく、このコンポーネント構造に従って切り出します。
