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
  - `ai-driven.issue-guidelines`: Issue と Requirements の役割を分け、Design で scope を足さないため。
  - `domain.payment`: 支払いカテゴリ任意、カテゴリなし、月次未分類集計の前提を守るため。
  - `domain.category`: カテゴリ削除時のカテゴリ未設定化とカテゴリ基本制約を守るため。
  - `web.domain-ui-rules`: 文脈別 UI 文言とカテゴリなし/不明/削除済み/取得失敗の混同禁止を守るため。
  - `web.design-rules`: 一覧、フォーム、詳細、サマリーの表示判断を Requirements の目的に沿わせるため。
  - `web.domain-rules`: shared domain value と feature/UI 表示の境界を守るため。
  - `web.test-policy`: AC に対応する回帰テスト方針を決めるため。
- Depends-on:
  - `ai-driven.overview`: AI Driven Development の工程前提。
  - `domain.amount`: 金額計算と表示の既存前提。
  - `domain.date`: 対象月範囲の既存前提。
- Conflict decision: none。複数データ更新や DB/API 変更は対象外なので、transaction boundary 追加判断は不要。

## Current Implementation Impact

- 支払い一覧のカテゴリ絞り込みは Requirements と整合している。`PaymentCategoryFilter.tsx` はカテゴリなし条件として `Uncategorized` を表示し、存在しない登録済みカテゴリ ID は `Unknown category` として分けている。
- 登録・編集フォームのカテゴリ未選択状態は Requirements と整合している。`CategorySelect.tsx` は `None` option を持ち、支払い form mapper は空カテゴリを `null` として扱う。
- 支払い詳細には gap がある。`PaymentDetailsOverlay.tsx` は `payment.category?.name ?? unknownCategory.name` を `CategoryField` に渡すため、カテゴリなし状態が `Unknown` と表示される。
- `PaymentDetailsOverlay.test.tsx`、`CategoryField.test.tsx`、`CategoryField.stories.tsx` にはカテゴリなし詳細表示を `Unknown` とする期待が残っている。
- 支払い一覧の行表示は Requirements と整合している。`PaymentList` / `PaymentItem` はカテゴリなし行でカテゴリ badge を出さず、既存テストは `Unknown` / `Uncategorized` が出ないことを確認している。
- 月次サマリーなどの集計は Requirements と整合している。`fetchCategoryTotals.ts` は未分類集計を `key: "uncategorized"`, `categoryId: null`, `kind: "uncategorized"`, `categoryName: "Uncategorized"` として扱い、実在カテゴリ名 `Unknown` と別に扱うテストがある。
- `unknownCategory` はカテゴリなし表示名ではなく、不明参照や欠落参照の fallback として残すべき値である。

## Adopted Approach

カテゴリなし支払いを 1 つの shared pseudo category 名で解決しない。UI 文脈ごとにユーザーが判断したいことが異なるため、表示責務を分ける。

- 支払い一覧のカテゴリ絞り込み: カテゴリなし支払いを検索・絞り込みする bucket として `Uncategorized` を使う。既存の絞り込み semantics を維持する。
- 登録・編集フォーム: カテゴリ未選択状態として `None` を使う。既存の空文字/`null` 変換と保存 payload を維持する。
- 支払い詳細: read-only のカテゴリ欄では、カテゴリなし状態を `None` として表示する。`Unknown` は使わない。
- 支払い一覧の行表示: カテゴリなし支払いにはカテゴリ text/badge を出さない。`None`、`Uncategorized`、`Unknown` のいずれも出さない。
- 月次サマリーなどの集計: 未分類集計 bucket として `Uncategorized` を使う。`key`, `categoryId`, `kind`, 金額計算は維持する。
- 実在カテゴリ名: `Unknown`、`None`、`Uncategorized` という名前の実在カテゴリは通常のカテゴリ名として扱う。カテゴリなし状態とは `categoryId`, `key`, `kind`, または category absence で区別する。

Build では、支払い詳細の fallback を `unknownCategory.name` から feature-local な詳細表示ラベル `None` へ差し替える。`CategorySelect` の `None` option は編集 control の未選択状態として維持する。`unknownCategory` は rename せず、カテゴリなし state には使わない。

## Rejected Alternatives

- `unknownCategory.name` を `None` または `Uncategorized` に rename しない。カテゴリなしと不明参照を同じ値にしてしまい、対象外文脈を巻き込むため。
- 支払い一覧の行表示で `None` または `Uncategorized` を出さない。一覧行はカテゴリ名表示の文脈であり、カテゴリなし支払いにはカテゴリ名が存在しないため。
- 登録・編集フォームの `None` を `Uncategorized` に変えない。フォームでは bucket ではなく未選択状態を扱うため。
- 月次サマリーの集計 bucket を `None` にしない。集計では未分類 bucket を識別する文脈だから。
- i18n 基盤、翻訳管理、locale switch は導入しない。今回の要求は現行英語 UI 表示の整理に限定されるため。
- ユーザー作成カテゴリとして `Uncategorized` や `None` を追加しない。カテゴリなしはカテゴリ entity ではないため。

## Domain Value UI Decisions

| 値 | 目的 | 主に見せるもの | Design decision |
| --- | --- | --- | --- |
| category | 支払いにカテゴリが紐付いているかを判断する | identity / absence | categoryId がある場合はカテゴリあり、null はカテゴリなしとして扱う。 |
| category name | カテゴリ紐付き支払いがどの分類かを判断する | identity | 実在カテゴリ名はそのまま表示する。`Unknown` / `None` / `Uncategorized` という実在名も置換しない。 |
| category filter bucket | 支払い一覧でカテゴリなし支払いを絞り込む | bucket / operation target | カテゴリなし条件名は `Uncategorized`。 |
| category selection state | 登録・編集フォームで未選択状態を理解する | state | 未選択状態は `None`。カテゴリ名ではない。 |
| payment detail category state | 詳細カテゴリ欄でカテゴリなし状態を理解する | state | read-only 表示は `None`。`Unknown` は使わない。 |
| uncategorized aggregate bucket | 集計でカテゴリなし支払い合計を識別する | breakdown / bucket | 集計 bucket は `Uncategorized`。`key: "uncategorized"` と `kind: "uncategorized"` を維持する。 |
| amount | 個別支払いまたは集計金額を判断する | value | 金額計算、通貨表記、差分表示は変更しない。 |
| target month | どの月の支払いを集計しているか判断する | supporting context | 既存の対象月範囲を維持する。 |

## Major Copy

- 支払い一覧のカテゴリ絞り込みのカテゴリなし条件: `Uncategorized`
- 登録・編集フォームのカテゴリ未選択状態: `None`
- 支払い詳細のカテゴリなし read-only 表示: `None`
- 支払い一覧のカテゴリなし行: カテゴリ text / badge なし
- 月次サマリーなどのカテゴリなし集計 bucket: `Uncategorized`
- カテゴリなし表示名として使わない文言: `Unknown`
- 実在カテゴリ名 `Unknown` / `None` / `Uncategorized`: ユーザー作成カテゴリ名としてそのまま表示できる

## Impacted Modules

### Web code

- `apps/web/src/features/payments/paymentDetails/PaymentDetailsOverlay/PaymentDetailsOverlay.tsx`
  - `payment.category?.name ?? unknownCategory.name` をやめ、カテゴリなし時の read-only カテゴリ欄に `None` を渡す。
  - カテゴリ編集時の category id / unset 保存 flow は変更しない。
- `apps/web/src/features/payments/paymentDetails/CategoryField/CategoryField.stories.tsx`
  - カテゴリなし詳細表示 story を `Unknown` から `None` へ更新する。
- `apps/web/src/features/payments/paymentDetails/CategoryField/CategoryField.test.tsx`
  - read-only 表示期待を `None` に更新し、編集開始時の combobox も `None` 選択状態であることを維持する。
- `apps/web/src/features/payments/paymentDetails/PaymentDetailsOverlay/PaymentDetailsOverlay.test.tsx`
  - `category` を `None` にして保存した後の詳細表示期待を `None` に更新し、`Unknown` が出ないことを確認する。

### 回帰確認対象

- `PaymentCategoryFilter.tsx` / `.test.tsx`: `Uncategorized` 絞り込みと `Unknown category` fallback の区別を維持する。
- `CategorySelect.tsx` / `.test.tsx`: `None` option と空文字/`null` 変換を維持する。
- `PaymentList.tsx`, `PaymentItem.tsx`, `PaymentList.test.tsx`, `PaymentItem.test.tsx`: カテゴリなし行でカテゴリ表示なしを維持する。
- `fetchCategoryTotals.ts`, `CategoryTotals.tsx`, 関連 tests: 集計 bucket `Uncategorized` と実在 `Unknown` カテゴリの区別を維持する。
- `unknownCategory.ts` と `toCategoryMap`: 不明/欠落参照 fallback として維持する。

## Existing Behavior Impact

- カテゴリ紐付き支払いのカテゴリ名表示、カテゴリ絞り込み、月次サマリー集計は維持する。
- カテゴリなし支払いは一覧から消えず、日付、メモ、金額、詳細表示への操作を維持する。
- 登録・編集フォームの `None` による unset 操作と保存 payload は変更しない。
- 支払い一覧のカテゴリなし行は、カテゴリ表示だけを持たない。
- 支払い詳細のカテゴリなし表示だけが `Unknown` から `None` に変わる。
- 月次サマリーの未分類集計は `Uncategorized` のまま維持し、金額、budget state、表示件数、対象月は変えない。
- DB/API/Auth/RLS/RPC、カテゴリ/支払い mutation 仕様、i18n 基盤は変更しない。

## Test Plan

- AC-1:
  - `PaymentCategoryFilter.test.tsx` で `Uncategorized` を選ぶとカテゴリなし支払いの filter value になる既存期待を維持する。
- AC-2:
  - `CategorySelect.test.tsx` と payment form mapper tests で、未選択状態が `None` / 空文字 / `null` として扱われる既存期待を維持する。
- AC-3, AC-7:
  - `PaymentDetailsOverlay.test.tsx` でカテゴリを unset した支払いの詳細カテゴリ欄が `None` になり、`Unknown` が出ないことを確認する。
  - `CategoryField.test.tsx` のカテゴリなし read-only story/test を `None` 期待へ更新する。
- AC-4, AC-5:
  - `PaymentList.test.tsx` / `PaymentItem.test.tsx` のカテゴリなし行ケースを維持し、`None` / `Uncategorized` / `Unknown` が表示されないことを確認する。`None` の不在確認がなければ追加する。
- AC-6:
  - `fetchCategoryTotals.integration.test.ts` と `CategoryTotals.test.tsx` の `Uncategorized` 集計期待を維持する。
- AC-8, AC-9:
  - 既存カテゴリ名表示/絞り込み/集計テストを維持する。
  - 実在カテゴリ名 `Unknown` の summary テストを維持する。
  - 実在カテゴリ名 `None` / `Uncategorized` との混同リスクが残る場合は、detail または summary の最小テストを追加する。
- AC-10:
  - diff review で DB/API/Auth/RLS/RPC、mutation 仕様、対象月、金額計算に変更がないことを確認する。

Storybook browser-test は、browser-test tagged stories、`apps/web/.storybook-test/`、Storybook browser-test 設定に触らない限り不要。

## Build / Verify Goal への入力

- 実装対象:
  - `apps/web/src/features/payments/paymentDetails/PaymentDetailsOverlay/PaymentDetailsOverlay.tsx`
  - `apps/web/src/features/payments/paymentDetails/PaymentDetailsOverlay/PaymentDetailsOverlay.test.tsx`
  - `apps/web/src/features/payments/paymentDetails/CategoryField/CategoryField.test.tsx`
  - `apps/web/src/features/payments/paymentDetails/CategoryField/CategoryField.stories.tsx`
- 原則変更不要だが回帰確認対象:
  - `PaymentCategoryFilter`, `CategorySelect`, `PaymentList`, `PaymentItem`, `fetchCategoryTotals`, `CategoryTotals`, `unknownCategory`, `toCategoryMap`
- Verification:
  - application code changes なので AGENTS.md の Web verification batch を実行する。
  - Storybook browser-test は browser-test 対象に触る場合だけ実行する。

## Risks / Stop

- `unknownCategory` を rename したくなった場合は停止する。カテゴリなし state と unknown/missing-reference fallback を混同するため。
- `None` をカテゴリ名として扱いたくなった場合は停止する。Requirements は状態表示として扱っているため。
- `Uncategorized` を category entity や固定ドメイン概念にしたくなった場合は停止する。
- DB/API/Auth/RLS/RPC、カテゴリ/支払い mutation 仕様、i18n 基盤、ユーザー作成カテゴリ追加が必要になった場合は停止する。
- Requirements にない copy、layout、成功条件を Design に追加する必要がある場合は停止する。
- Design が選択したルール・ポリシーに違反する可能性がある場合は停止する。
