---
title: Domain Layer Rules
doc_type: policy
status: accepted
area: web
applies_to:
  - apps/web/src/domain
  - apps/web/src/features
  - apps/web/src/utils
topics:
  - domain-layer
  - project-structure
  - frontend-architecture
when_to_read:
  - Webアプリにdomainを追加するとき
  - featuresまたはutilsから横断的な値ルールを切り出すとき
  - Webアプリ内の値ルールの配置に迷うとき
---

# Domain Layer Rules

この文書は、`apps/web/src/domain` に置くコードの責務と配置ルールです。

UI上の文言、表示判断、状態表現、ドメイン値の見せ方は [Domain UI Rules](./domain-ui-rules.md) に従います。この文書では、UI判断そのものではなく、複数 feature で共有する値ルールをどの layer に置くかを扱います。

UIコンポーネントや特定画面の都合ではなく、入力、保存、比較、表示変換などで同じ扱いにすべき値ルールを `apps/web/src/domain` に集約します。
APIやDB契約の型を置くだけの場所ではなく、Webアプリ内で一貫させたい振る舞いを持つものを対象にします。

## 置くもの

`domain` に置く対象は、以下を満たす値概念です。

- 複数 feature から利用される、または利用される見込みがある
- feature 固有のユースケースではなく、値そのものの扱いとして説明できる
- schema、parser、formatter、form value 変換などを通じて、アプリ内で同じルールを保つ必要がある

現在の例は以下です。

- `amount`: 金額入力値の schema、required/optional の扱い、フォーム表示値変換
- `date`: date-only 文字列、月初/月末、target month key

## 配置

domain のファイル名は、実装方式ではなく概念名に寄せます。

例: `amount.ts`, `date.ts`

概念ごとに 1 ファイルを基本とします。
`amount/schema.ts` や `date/formatter.ts` のような実装別分割は、公開 API が増えて単一ファイルでは見通しが悪くなるまで避けます。

schema、parser、formatter、form value 変換は、その概念の値ルールであれば同じ domain ファイルに置けます。
内部の正規化処理や小さな helper は export せず、公開 API とテスト対象を必要なものに絞ります。

## 置かないもの

feature 固有のルールは `features/<feature>` に残します。

UI表示用の文言、fallback label、empty state label、状態ラベル、画面上の状態表現は `domain` に置きません。

現在の `categoryName` は categories feature に閉じたルールとして扱います。
`payment note` も payments feature に閉じたルールとして扱います。

汎用配列操作、UI hook、Postgres エラー判定など、ドメイン概念を持たないものは `utils` など既存の層に残します。

`components/inputs` は入力 UI コンポーネントのための場所です。
`amount` などの値ルールは入力コンポーネントではなく `domain` に置きます。
