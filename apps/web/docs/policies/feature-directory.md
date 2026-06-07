---
title: Feature Directory
doc_type: policy
status: accepted
area: web
applies_to:
  - apps/web/src/features
topics:
  - feature-directory
  - project-structure
  - frontend-architecture
when_to_read:
  - Webアプリに新しい機能ディレクトリを追加するとき
  - features配下の構成を変更するとき
---

# Feature Directory

Webアプリの `features/` 配下は、feature-first で管理します。

feature 配下の配置は、実装の種類ではなく、利用範囲と責務で決めます。
新しいコードを追加または移動するときは、先にそのコードがどのユースケース、feature、またはアプリ全体に属するのかを確認します。

## 目的

この policy は、以下を目的とします。

- 各 feature を独立した単位として管理しやすくする
- 関連するコードを一箇所にまとめ、変更対象を見つけやすくする
- ユースケース固有のコードと feature 共通コードの境界を明確にする
- 新しい機能追加や既存 feature 変更時の配置判断を一貫させる

## 配置ルール

### 基本構成

`features/<feature-name>/` 配下は、機能全体で共有するコードと、具体的なユースケース単位の slice で構成します。

```
features/<feature-name>/
  index.ts              # feature 外へ公開する入口
  components/           # その機能の複数ユースケースで共有するUIコンポーネント
  utils/                # その機能の複数ユースケースで共有するユーティリティ
  types/                # その機能の複数ユースケースで共有する型定義
  <use-case-name>/      # 作成、一覧、詳細、更新などのユースケース単位のslice
    <ComponentName>/    # そのユースケースに特化したUIコンポーネント
    useExample.ts       # そのユースケースに特化したhook
    fetchExample.ts     # そのユースケースに特化したデータ取得
```

feature 直下の `index.ts` は、その feature の公開面として扱います。
外部 feature から参照してよいコンポーネント、処理、型、query key などだけを `index.ts` からエクスポートします。

### 1つのユースケースだけで使うコード

1つのユースケース slice だけで使うコードは、その slice 配下に置きます。

対象には、コンポーネント、hook、schema、adapter、mapper、fetch、値ルールなどを含みます。
UIコンポーネントを追加する場合は、`apps/web/docs/policies/component-structure.md` に従ってコンポーネント単位のディレクトリに配置します。

### 同じFeatureの複数ユースケースで使うコード

同じ feature の複数ユースケースで使うコードは、まず feature 直下に置きます。
既存の feature 共通ディレクトリの責務に明確に合う場合だけ、そのディレクトリに置きます。

UI コンポーネントは `components/`、型は `types/` など、既存の feature 共通ディレクトリで責務を説明できる場合はそこに置きます。
`utils/` は、特定の目的別ファイルとして説明しにくく、かつ feature 内で共有される小さな補助処理に限ります。
schema、adapter、mapper、fetch、hook、値ルールなどの目的別ファイルは、分類に迷ったという理由だけで汎用的な補助処理の置き場へ移してはいけません。

feature root 直下に置くファイルは、`queryKeys.ts` のような feature 全体の公開面、または feature 内の複数ユースケースで共有される目的別ファイルに絞ります。
ユースケース slice や feature 共通ディレクトリではなく root 直下に置く場合は、その理由を説明できる必要があります。

### Feature共通ディレクトリを追加する場合

feature 共通ディレクトリを追加する場合は、既存の共通ディレクトリに置けない理由と、責務・利用範囲を説明できる名前にします。
実装方式だけを表す曖昧な分類名を、その場の都合で増やしてはいけません。

目的別ディレクトリは、feature 直下の目的別ファイルが増え、責務ごとに分けないと見通しが悪くなる場合にだけ追加します。
追加する場合は、責務、利用範囲、既存配置に置けない理由をこの policy に明記してから使います。

### 複数Featureで共有するコード

複数 feature で共有される値ルールは、`apps/web/docs/policies/domain-rules.md` に従って `apps/web/src/domain` への切り出しを検討します。

複数 feature で共有される UI は、`apps/web/src/components` に置くか、feature 間で共有してよい公開コンポーネントとして扱えるかを確認します。

### ユースケースSlice名

ユースケース slice 名は、既存の `createPayment`, `listPayment`, `paymentDetails`, `updateMonthlyBudget` のように、操作または目的と対象が分かる名前にします。
read 系の slice を追加または整理するときは、画面単位、操作単位、取得単位のどれを表すのかが分かる名前を選びます。

### Feature間Import

feature 間 import は、所有境界が曖昧になりやすいため、依存先 feature の公開面に限定します。
外部 feature からは `features/<feature-name>` から import し、依存先 feature 配下の個別ファイルやユースケース slice を直接 import してはいけません。
