---
title: "Design / Plan: カテゴリなし支払いの文脈別表示を整理する"
doc_type: design
status: draft
area: repository
applies_to:
  - docs/ai-driven-development
  - apps/web
topics:
  - ai-driven-development
  - design
  - payment
  - category
  - domain-ui
  - summary
when_to_read:
  - Issue #1480 のカテゴリなし支払い表示整理を実装するとき
  - カテゴリなし支払い表示整理の Build / Verify Goal を作成するとき
---

# Design / Plan: カテゴリなし支払いの文脈別表示を整理する

## 入力と前提

この Design は `docs/ai-driven-development/workspaces/1480-uncategorized-payments/requirements.md` を source of truth とする。既存実装と既存テストは影響範囲を確認するためにだけ使い、product scope は Requirements の意図、制約、対象外、受け入れ条件から決める。

カテゴリ未設定の支払いはドメイン上「カテゴリなし」または「未分類」である。現行英語 UI では、文脈ごとに `Uncategorized`、`None`、表示なしを使い分ける。`Unknown` はカテゴリなし表示名ではなく、不明参照、取得不能、削除済みカテゴリなどの fallback 文脈に限る。

`None`、`Uncategorized`、`Unknown` はユーザー作成カテゴリ名として禁止しない。実在カテゴリ名と同じ文字列の system label が同じ表示単位に出る場合は、追加説明テキスト、補助ラベル、ARIA label などの非表示ラベルへの追加説明語を使わず、system label 本体の視覚表現で区別する。

対象は支払い一覧のカテゴリ絞り込み、登録・編集フォーム、支払い詳細、支払い一覧の行表示、月次サマリーなどの集計に限定する。DB/API/Auth/RLS/RPC、カテゴリ/支払い mutation 仕様、i18n 基盤、ユーザー作成カテゴリ追加、対象月、金額計算は変更しない。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `docs/ai-driven-development/workspaces/1480-uncategorized-payments/design.md`, `apps/web/src/features/payments/**`, `apps/web/src/features/summaryByMonth/**`
  - domain: `payment`, `category`, `web-ui`
  - activity: `write_design_doc`, `change_payment_ui`, `change_category_ui`, `change_test`
  - topic: `design-doc`, `payment`, `category`, `domain-ui`, `summary`
- Selected:
  - `ai-driven.workflow`: Design / Plan の責務を守るため。
  - `ai-driven.issue-guidelines`: Issue、Requirements、Design の役割を分け、Design で scope を足さないため。
  - `policy.review-feedback-classification`: PR #1490 のレビュー指摘を Requirements 入力として扱う境界を守るため。
  - `domain.payment`: 支払いカテゴリ任意、カテゴリなし、月次未分類集計の前提を守るため。
  - `domain.category`: カテゴリ削除時のカテゴリ未設定化とカテゴリ基本制約を守るため。
  - `web.domain-ui-rules`: 文脈別 UI 文言、同名 system label 衝突時の予約語禁止不可、追加説明語禁止、視覚表現による区別を守るため。
  - `web.design-rules`: 一覧、フォーム、詳細、サマリーの文字階層、色 token、状態表現を Requirements の目的に沿わせるため。
  - `web.test-policy`: AC に対応する回帰テスト方針を決めるため。
- Depends-on:
  - `ai-driven.overview`: AI Driven Development の工程前提。
  - `domain.amount`: 金額計算と表示の既存前提。
  - `domain.date`: 対象月範囲の既存前提。
- Conflict decision: 更新済み `web.domain-ui-rules` を優先する。カテゴリ名を予約語にせず、`No category` のような追加説明語も使わない。古い helper-text 方針は採用しない。

## Current Implementation Impact

- 支払い一覧のカテゴリ絞り込みは、カテゴリなし条件として `Uncategorized` を表示し、存在しない登録済みカテゴリ ID は `Unknown category` として分けている。実在カテゴリ名 `Uncategorized` がある場合、system bucket と実在カテゴリ名が同じ文字列で並び得る。
- 登録・編集フォームと支払い詳細のカテゴリ編集では、`CategorySelect` が `None` option を持ち、空カテゴリを `null` として扱う。実在カテゴリ名 `None` がある場合、未選択状態の `None` と実在カテゴリ名 `None` が同じ文字列で並び得る。
- 支払い詳細では、カテゴリなし state を `None` として表示する必要がある。read-only 表示が通常カテゴリ名と同じ見た目の `None` だけだと、実在カテゴリ名 `None` の支払いとカテゴリなし支払いを区別できない。
- 支払い一覧の行表示は Requirements と整合している。カテゴリなし行ではカテゴリ text/badge を出さず、`None` / `Uncategorized` / `Unknown` のいずれも出さない設計を維持する。
- 月次サマリーなどの集計は、未分類集計を `key: "uncategorized"`, `categoryId: null`, `kind: "uncategorized"`, `categoryName: "Uncategorized"` として扱う。実在カテゴリ名 `Uncategorized` の集計行とカテゴリなし bucket 行を視覚的に区別する必要がある。
- `unknownCategory` はカテゴリなし表示名ではなく、不明参照や欠落参照の fallback として残す。

## Adopted Approach

カテゴリなし支払いを 1 つの shared pseudo category 名で解決しない。UI 文脈ごとにユーザーが判断したいことが異なるため、表示責務を分ける。

- 支払い一覧のカテゴリ絞り込み: カテゴリなし支払いを検索・絞り込みする bucket として `Uncategorized` を使う。system bucket の `Uncategorized` は gray tone で表示し、実在カテゴリ名 `Uncategorized` は通常カテゴリ名の tone で表示する。
- 登録・編集フォーム: カテゴリ未選択状態として `None` を使う。system state の `None` は gray tone で表示し、実在カテゴリ名 `None` は通常カテゴリ名の tone で表示する。
- 支払い詳細: read-only のカテゴリ欄では、カテゴリなし状態を `None` として表示する。カテゴリなし状態の `None` は `Text color="gray"` 相当で表示し、実在カテゴリ名 `None` は通常の詳細値 tone で表示する。
- 支払い一覧の行表示: カテゴリなし支払いにはカテゴリ text/badge を出さない。`None`、`Uncategorized`、`Unknown` のいずれも出さない。
- 月次サマリーなどの集計: 未分類集計 bucket として `Uncategorized` を使う。`kind: "uncategorized"` の `Uncategorized` は gray tone で表示し、`kind: "category"` の実在カテゴリ名 `Uncategorized` は通常カテゴリ名の tone で表示する。
- 実在カテゴリ名: `Unknown`、`None`、`Uncategorized` という名前の実在カテゴリは通常のカテゴリ名として扱う。カテゴリなし状態とは `categoryId`, `key`, `kind`, または category absence で区別する。

system label の視覚表現は、既存 design token を使う。具体的には `Text color="gray"` 相当の gray tone を system label 本体に適用する。`No category` のような追加テキストは表示しない。`aria-label="None No category"` や `aria-label="Uncategorized No category"` のような追加説明語も使わない。Select item の accessible name は表示文字列と同じ `None` / `Uncategorized` に留める。

Select の閉じた trigger 表示でも、選択中の system label が通常カテゴリ名と同じ見た目になってはいけない。Radix Themes の item 表示だけで trigger 側の tone が維持できない場合は、system value 選択中の trigger に既存 token ベースの gray tone を適用する局所 class または props を使う。ただし accessible name には追加説明語を入れない。

## Rejected Alternatives

- `No category` などの補助テキストを添えない。Requirements と Domain UI policy が追加説明語による区別を禁止しているため。
- `aria-label` などの非表示ラベルへ追加説明語を入れない。視覚表現と accessible name の意味を分離して区別したことにしないため。
- `unknownCategory.name` を `None` または `Uncategorized` に rename しない。カテゴリなしと不明参照を同じ値にしてしまうため。
- `None` / `Uncategorized` / `Unknown` をカテゴリ名の予約語として禁止しない。ユーザー入力名の制約変更で UI の曖昧さを解決しないため。
- 支払い一覧の行表示で `None` または `Uncategorized` を出さない。一覧行はカテゴリ名表示の文脈であり、カテゴリなし支払いにはカテゴリ名が存在しないため。
- 登録・編集フォームの `None` を `Uncategorized` に変えない。フォームでは bucket ではなく未選択状態を扱うため。
- 月次サマリーの集計 bucket を `None` にしない。集計では未分類 bucket を識別する文脈だから。
- i18n 基盤、翻訳管理、locale switch は導入しない。今回の要求は現行英語 UI 表示の整理に限定されるため。
- `Uncategorized` を `System Uncategorized` などの別ラベルに置き換えない。Requirements の現行英語 UI 表示を維持するため。

## Domain Value UI Decisions

| 値 | 目的 | 主に見せるもの | Design decision |
| --- | --- | --- | --- |
| category | 支払いにカテゴリが紐付いているかを判断する | identity / absence | categoryId がある場合はカテゴリあり、null はカテゴリなしとして扱う。 |
| category name | カテゴリ紐付き支払いがどの分類かを判断する | identity | 実在カテゴリ名は通常 tone でそのまま表示する。`Unknown` / `None` / `Uncategorized` という実在名も置換せず予約しない。 |
| category filter bucket | 支払い一覧でカテゴリなし支払いを絞り込む | bucket / operation target | カテゴリなし条件名は `Uncategorized`。system bucket は gray tone、実在カテゴリ名は通常 tone。 |
| category selection state | 登録・編集フォームで未選択状態を理解する | state | 未選択状態は `None`。system state は gray tone、実在カテゴリ名は通常 tone。 |
| payment detail category state | 詳細カテゴリ欄でカテゴリなし状態を理解する | state | read-only 表示は `None`。カテゴリなし状態は gray tone、実在カテゴリ名 `None` は通常 tone。 |
| uncategorized aggregate bucket | 集計でカテゴリなし支払い合計を識別する | breakdown / bucket | 集計 bucket は `Uncategorized`。`kind: "uncategorized"` は gray tone、`kind: "category"` は通常 tone。 |
| fallback category label | 参照先が不明または存在しないことを判断する | fallback | `Unknown category` はカテゴリなしではなく不明参照/欠落参照に限る。 |
| amount | 個別支払いまたは集計金額を判断する | value | 金額計算、通貨表記、差分表示は変更しない。 |
| target month | どの月の支払いを集計しているか判断する | supporting context | 既存の対象月範囲を維持する。 |

## Major Copy

- 支払い一覧のカテゴリ絞り込みのカテゴリなし条件: `Uncategorized`
- 登録・編集フォームのカテゴリ未選択状態: `None`
- 支払い詳細のカテゴリなし read-only 表示: `None`
- 支払い一覧のカテゴリなし行: カテゴリ text / badge なし
- 月次サマリーなどのカテゴリなし集計 bucket: `Uncategorized`
- カテゴリなし表示名として使わない文言: `Unknown`
- 不明参照/欠落参照 fallback: `Unknown category`
- 使わない文言: `No category` などの追加説明テキスト

## Impacted Modules

### Web code

- `apps/web/src/features/categories/components/CategorySelect/CategorySelect.tsx`
  - `NoneCategoryOption` は visible text を `None` のみに戻し、`Text color="gray"` 相当で system state として表示する。
  - `aria-label` に追加説明語を入れない。必要なら aria-label 自体を削除し、visible text 由来の accessible name にする。
  - `CategoryOption` の実在カテゴリ名 `None` は通常カテゴリとして通常 tone で表示する。
  - Select trigger は system `None` 選択中も gray tone で表示できるようにする。item children の tone が trigger に反映されない場合は、system value 選択時だけ trigger に gray tone を適用する。
- `apps/web/src/features/payments/listPayment/PaymentCategoryFilter/PaymentCategoryFilter.tsx`
  - カテゴリなし filter option は visible text を `Uncategorized` のみに戻し、gray tone で system bucket として表示する。
  - `aria-label` に追加説明語を入れない。
  - 実在カテゴリ名 `Uncategorized` の `CategoryOption` は通常カテゴリとして通常 tone で表示する。
  - filter trigger は category search がカテゴリなしの場合、gray tone の `Uncategorized` として見えるようにする。
- `apps/web/src/features/payments/paymentDetails/PaymentDetailsOverlay/PaymentDetailsOverlay.tsx`
  - カテゴリなし時は `None` state として `CategoryField` に渡す。`Unknown` fallback は使わない。
  - カテゴリ編集時の category id / unset 保存 flow は変更しない。
- `apps/web/src/features/payments/paymentDetails/CategoryField/CategoryField.tsx`
  - read-only のカテゴリなし表示は `None` のみを表示し、`categoryId === null` のときだけ gray tone にする。
  - 実在カテゴリ名 `None` は通常 tone で表示する。
  - `No category` などの追加テキストは表示しない。
- `apps/web/src/features/payments/paymentDetails/CategoryField/CategoryField.stories.tsx`
  - カテゴリなし詳細表示 story は `None` の gray tone 前提にする。
  - 実在カテゴリ名 `None` の story を維持し、通常 tone で区別できることを示す。
- `apps/web/src/features/summaryByMonth/CategoryTotals/CategoryTotals.tsx`
  - `kind: "uncategorized"` の行では、`Uncategorized` 自体を gray tone で表示する。
  - `kind: "category"` かつ実在カテゴリ名 `Uncategorized` の行は通常 tone で表示する。
  - `No category` などの追加テキストは表示しない。
- `apps/web/src/features/summaryByMonth/CategoryTotals/fetchCategoryTotals.integration.test.ts`
  - data boundary として `key`, `categoryId`, `kind` により実在カテゴリ名 `Uncategorized` とカテゴリなし bucket が分離されることを確認する。

### 回帰確認対象

- `PaymentList`, `PaymentItem`: カテゴリなし行でカテゴリ表示なしを維持する。
- `unknownCategory`, `toCategoryMap`: 不明/欠落参照 fallback として維持する。
- payment form mapper / category unset flow: `None` 選択時の空文字/`null` 変換を維持する。

## Existing Behavior Impact

- カテゴリ紐付き支払いのカテゴリ名表示、カテゴリ絞り込み、月次サマリー集計は維持する。
- 実在カテゴリ名 `None` / `Uncategorized` / `Unknown` は入力禁止にせず、通常カテゴリ名として表示する。
- カテゴリなし支払いは一覧から消えず、日付、メモ、金額、詳細表示への操作を維持する。
- 登録・編集フォームの `None` による unset 操作と保存 payload は変更しない。
- 支払い一覧のカテゴリなし行は、カテゴリ表示だけを持たない。
- 支払い詳細のカテゴリなし表示は `None` とし、追加説明語なしで gray tone にする。
- 支払い一覧のカテゴリ絞り込みと月次サマリーのカテゴリなし bucket は `Uncategorized` とし、追加説明語なしで gray tone にする。
- 月次サマリーの未分類集計は `Uncategorized` のまま維持し、金額、budget state、表示件数、対象月は変えない。
- DB/API/Auth/RLS/RPC、カテゴリ/支払い mutation 仕様、i18n 基盤は変更しない。

## Test Plan

- AC-1:
  - `PaymentCategoryFilter.test.tsx` で `Uncategorized` を選ぶとカテゴリなし支払いの filter value になる既存期待を維持する。
  - 実在カテゴリ名 `Uncategorized` がある場合、system bucket option と実在カテゴリ option がどちらも `Uncategorized` の visible/accessible name を持ちつつ、system bucket 側だけ gray tone で区別されることを確認する。
- AC-2:
  - `CategorySelect.test.tsx` と payment form mapper tests で、未選択状態が `None` / 空文字 / `null` として扱われる既存期待を維持する。
  - 実在カテゴリ名 `None` がある場合、system option と実在カテゴリ option がどちらも `None` の visible/accessible name を持ちつつ、system option 側だけ gray tone で区別されることを確認する。
- AC-3, AC-7:
  - `PaymentDetailsOverlay.test.tsx` でカテゴリを unset した支払いの詳細カテゴリ欄が `None` になり、`Unknown` と `No category` が出ないことを確認する。
  - `CategoryField.test.tsx` でカテゴリなし read-only の `None` が gray tone で、実在カテゴリ名 `None` は通常 tone であることを確認する。
- AC-4, AC-5:
  - `PaymentList.test.tsx` / `PaymentItem.test.tsx` のカテゴリなし行ケースを維持し、`None` / `Uncategorized` / `Unknown` が表示されないことを確認する。
- AC-6, AC-10:
  - `CategoryTotals.test.tsx` で、実在カテゴリ名 `Uncategorized` の行は通常 tone、カテゴリなし bucket 行は gray tone であることを確認する。
  - `fetchCategoryTotals.integration.test.ts` で、実在カテゴリ名 `Uncategorized` と `kind: "uncategorized"` bucket が `key` / `categoryId` / `kind` で分離されることを確認する。
- AC-8:
  - 既存カテゴリ名表示/絞り込み/集計テストを維持する。
  - 実在カテゴリ名 `Unknown` の summary テストを維持する。
- AC-9, AC-11, AC-12:
  - 実在カテゴリ名 `None` / `Uncategorized` が通常カテゴリとして扱われ、カテゴリ名 validation や create/update 制約が変わらないことを diff review と focused tests で確認する。
  - `No category` のような visible text が出ないこと、`aria-label` や role name に追加説明語が入らないことを確認する。
- AC-13:
  - diff review で DB/API/Auth/RLS/RPC、mutation 仕様、対象月、金額計算に変更がないことを確認する。

Storybook browser-test は、browser-test tagged stories、`apps/web/.storybook-test/`、Storybook browser-test 設定に触らない限り不要。

## Build / Verify Goal への入力

- 実装対象:
  - `apps/web/src/features/categories/components/CategorySelect/CategorySelect.tsx`
  - `apps/web/src/features/categories/components/CategorySelect/CategorySelect.test.tsx`
  - `apps/web/src/features/payments/listPayment/PaymentCategoryFilter/PaymentCategoryFilter.tsx`
  - `apps/web/src/features/payments/listPayment/PaymentCategoryFilter/PaymentCategoryFilter.test.tsx`
  - `apps/web/src/features/payments/paymentDetails/PaymentDetailsOverlay/PaymentDetailsOverlay.tsx`
  - `apps/web/src/features/payments/paymentDetails/PaymentDetailsOverlay/PaymentDetailsOverlay.test.tsx`
  - `apps/web/src/features/payments/paymentDetails/CategoryField/CategoryField.tsx`
  - `apps/web/src/features/payments/paymentDetails/CategoryField/CategoryField.test.tsx`
  - `apps/web/src/features/payments/paymentDetails/CategoryField/CategoryField.stories.tsx`
  - `apps/web/src/features/summaryByMonth/CategoryTotals/CategoryTotals.tsx`
  - `apps/web/src/features/summaryByMonth/CategoryTotals/CategoryTotals.test.tsx`
  - `apps/web/src/features/summaryByMonth/CategoryTotals/fetchCategoryTotals.integration.test.ts`
- 原則変更不要だが回帰確認対象:
  - `PaymentList`, `PaymentItem`, `unknownCategory`, `toCategoryMap`, category name validation, category mutation flow
- Verification:
  - application code changes なので AGENTS.md の Web verification batch を実行する。
  - Storybook browser-test は browser-test 対象に触る場合だけ実行する。

## Risks / Stop

- `unknownCategory` を rename したくなった場合は停止する。カテゴリなし state と unknown/missing-reference fallback を混同するため。
- カテゴリなし状態の `None` を category entity として扱いたくなった場合は停止する。Requirements は状態表示として扱っているため。
- カテゴリなし bucket の `Uncategorized` を category entity や固定ドメイン概念にしたくなった場合は停止する。
- `None` / `Uncategorized` / `Unknown` をカテゴリ名として禁止したくなった場合は停止する。
- 同名衝突を追加説明テキスト、補助ラベル、ARIA label などの非表示ラベルへの追加説明語で解決したくなった場合は停止する。
- 視覚表現だけでは accessible な区別が成立しないと判断した場合は停止し、Requirements の no-extra-label constraint とアクセシビリティ要件の衝突として扱う。
- DB/API/Auth/RLS/RPC、カテゴリ/支払い mutation 仕様、i18n 基盤、ユーザー作成カテゴリ追加が必要になった場合は停止する。
- Requirements にない copy、layout、成功条件を Design に追加する必要がある場合は停止する。
- Design が選択したルール・ポリシーに違反する可能性がある場合は停止する。
