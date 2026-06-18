---
title: "Design / Plan: 支払い一覧とサマリーの未カテゴリ表示を調整する"
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
  - summary
when_to_read:
  - Issue #1480 の未カテゴリ支払い実装方針を確認するとき
  - 未カテゴリ支払い表示調整の Build / Verify Goal を作成するとき
---

# Design / Plan: 支払い一覧とサマリーの未カテゴリ表示を調整する

## 入力と前提

この Design は `docs/ai-driven-development/workspaces/1480-uncategorized-payments/requirements.md` を source of truth とする。Issue #1480 は補助入力として扱い、Requirements / PRD の意図、制約、対象外、受け入れ条件を上書きしない。

今回の対象は、カテゴリ未紐付き支払いの一覧表示と月次サマリーの未カテゴリ集計名である。カテゴリ作成、更新、削除、支払い作成、更新、削除、DB / API / 認証 / 権限、フィルター、並び順、集計単位の追加は対象外とする。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `docs/ai-driven-development/workspaces/1480-uncategorized-payments/design.md`, `apps/web/src/features/payments/**`, `apps/web/src/features/summaryByMonth/**`, `apps/web/src/features/categories/unknownCategory.ts`
  - domain: `payment`, `category`, `web-ui`
  - activity: `write_design_doc`, `change_payment_ui`, `change_category_ui`, `review_frontend_domain_boundary`, `change_test`
  - topic: `design-doc`, `payment`, `category`, `domain-ui`, `test`
- Selected:
  - `ai-driven.workflow`: Design / Plan の責務を守るため。
  - `ai-driven.issue-guidelines`: Issue を Requirements の入力として扱い、Design で product scope を足さないため。
  - `domain.payment`: 支払いカテゴリは任意で、カテゴリ未設定支払いはカテゴリなしとして扱う前提を守るため。
  - `domain.category`: カテゴリ削除後の関連支払いがカテゴリ未設定になる前提を守るため。
  - `web.domain-ui-rules`: 未設定、不明、取得失敗、状態ラベル、通常値の混同を避けるため。
  - `web.design-rules`: 一覧とサマリーの文字階層、表示密度、状態表示の境界を守るため。
  - `web.domain-rules`: shared value rule を feature/domain のどちらに置くか判断するため。
  - `web.test-policy`: ユーザーに残る挙動の regression test 方針を決めるため。
- Depends-on: `ai-driven.overview`, `domain.amount`, `domain.date`
- Conflict decision: none。複数データ更新や DB / API 変更は対象外なので、`policy.transaction-boundaries` は選択しない。

## Current State

- `apps/web/src/features/categories/unknownCategory.ts` は `name: "Unknown"` の疑似カテゴリを提供している。
- `apps/web/src/features/payments/listPayment/PaymentList/PaymentList.tsx` は、支払いの `payment.category` がない場合に `unknownCategory` を `PaymentItem` へ渡している。
- `apps/web/src/features/payments/listPayment/PaymentItem/PaymentItem.tsx` は `category` を必須 prop とし、`category.name` を badge と button の `aria-label` に含めている。そのためカテゴリ未紐付き支払いも一覧で `Unknown` のカテゴリ表示を持つ。
- `apps/web/src/features/summaryByMonth/CategoryTotals/fetchCategoryTotals.ts` は、カテゴリ未設定支払いを `key: "uncategorized"`, `kind: "uncategorized"` で別 key にしているが、表示名には `unknownCategory.name` を使うため `Unknown` として表示される。
- `CategoryTotals` 系テストには、未分類支払いが `Unknown` に集計されること、実在カテゴリ名 `Unknown` と未分類支払いを別 key / 別行で扱うことの確認がある。

## Adopted Approach

未カテゴリ支払いの表示名を1つの shared pseudo category として扱わない。支払い一覧とサマリーではユーザーが判断したいことが異なるため、表示責務を分ける。

- 支払い一覧: カテゴリ未紐付き支払いではカテゴリ badge を表示しない。button の `aria-label` からも存在しないカテゴリ名を除く。
- サマリー: カテゴリ未設定支払いの集計行は `key: "uncategorized"` と `kind: "uncategorized"` を維持し、表示名だけを `Uncategorized` にする。
- 実在カテゴリ名 `Unknown` は通常カテゴリの `categoryName` として残せる。未分類集計は key / kind で実在カテゴリと区別する。

具体的には、一覧用の `PaymentItem` はカテゴリを optional / nullable として受け取り、カテゴリがある場合だけ badge を出す。`PaymentList` は missing category を `unknownCategory` に変換せず、支払いのカテゴリ有無をそのまま渡す。サマリー用には `Uncategorized` の集計表示名を summary 側の値として定義し、`unknownCategory.name` への依存を切る。

`unknownCategory` は、支払い詳細など現在 `Unknown` 表示を使う別文脈があるため、この Design では削除や名称変更をしない。Build で未使用になる場合でも、今回の対象外画面に影響しない範囲で扱う。

## Rejected Alternatives

- `unknownCategory.name` を `Uncategorized` に変更する案は採用しない。
  - 支払い一覧でも `Uncategorized` badge が出る可能性があり、Requirements の「一覧にカテゴリ表示を出さない」に反するため。
  - 支払い詳細など、今回対象外の `Unknown` 表示まで変える可能性があるため。
- 支払い一覧で `Unknown` を `Uncategorized` badge に置き換える案は採用しない。
  - `Uncategorized` はサマリー集計名として定義されており、一覧ではカテゴリ表示を出さない要求だから。
- サマリーで `Unknown` を残す案は採用しない。
  - Requirements の AC-3 / AC-4 を満たせないため。
- 実在カテゴリ名 `Unknown` を特別扱いする案は採用しない。
  - ユーザー作成カテゴリは通常カテゴリとして扱い、未分類集計は key / kind で分ける既存設計を維持すれば足りるため。

## Domain Value UI Decisions

| 値 | 目的 | 主に見せるもの | Design decision |
| --- | --- | --- | --- |
| category | 支払いにカテゴリが紐付いているか識別する | identity / absence | 一覧ではカテゴリがある場合だけカテゴリ badge を出す。未設定を状態 badge にしない。 |
| category name | カテゴリ紐付き支払いがどの分類か知る | identity | 実在カテゴリ名は既存どおり一覧 badge とサマリー行名に出す。 |
| uncategorized aggregate label | 未設定支払いの合計を集計単位として識別する | identity / breakdown | サマリーだけ `Uncategorized` を表示名にする。ユーザー作成カテゴリではない。 |
| payment amount | 個別支払いまたは集計金額を知る | value | 金額計算、通貨表記、差分表示は変更しない。 |
| target month | どの月の支払い集計か知る | supporting context | 既存の対象月範囲を維持し、月次集計範囲は変更しない。 |

## Major Copy

- 支払い一覧のカテゴリ未紐付き支払い: カテゴリ表示なし。
- サマリーのカテゴリ未設定支払い集計名: `Uncategorized`
- 実在カテゴリ名 `Unknown`: ユーザー作成カテゴリ名としてそのまま `Unknown`
- 新しい状態ラベル、helper text、error copy は追加しない。

## Impacted Modules

### Web code

- `apps/web/src/features/payments/listPayment/PaymentList/PaymentList.tsx`
  - `payment.category ?? unknownCategory` の変換をやめ、カテゴリ有無を `PaymentItem` へ渡す。
- `apps/web/src/features/payments/listPayment/PaymentItem/PaymentItem.tsx`
  - `category` を nullable / optional にし、カテゴリがある場合だけ badge と aria-label のカテゴリ部分を含める。
  - カテゴリがない場合も日付、メモ、金額、行操作は維持する。
- `apps/web/src/features/summaryByMonth/CategoryTotals/fetchCategoryTotals.ts`
  - 未分類集計の `key`, `categoryId`, `kind`, 金額計算、budget state は維持し、`categoryName` だけ `Uncategorized` にする。
- `apps/web/src/features/categories/unknownCategory.ts`
  - 今回の採用案では変更不要。Build で未使用化する場合は、対象外画面への影響を確認してから判断する。

### Tests / stories

- `apps/web/src/features/payments/listPayment/PaymentItem/PaymentItem.test.tsx`
- `apps/web/src/features/payments/listPayment/PaymentItem/PaymentItem.stories.tsx`
- `apps/web/src/features/payments/listPayment/PaymentList/PaymentList.test.tsx`
- `apps/web/src/features/summaryByMonth/CategoryTotals/CategoryTotals.test.tsx`
- `apps/web/src/features/summaryByMonth/CategoryTotals/fetchCategoryTotals.integration.test.ts`

## Existing Behavior Impact

- カテゴリ紐付き支払いの一覧 badge、日付、メモ、金額、詳細表示への操作は維持する。
- カテゴリ未紐付き支払いは一覧から消えず、日付、メモ、金額、詳細表示への操作を維持する。
- カテゴリ未紐付き支払いの一覧行は、カテゴリ badge だけを持たない。
- サマリーのカテゴリ別合計額、budget state、差分、ピン留め優先順、表示件数切り替えは維持する。
- 未分類集計の key は `uncategorized` のままにし、実在カテゴリ名 `Unknown` とは別行で表示できる。
- DB / API / 認証 / 権限、カテゴリ/支払い作成更新削除、フィルター、並び順は変更しない。

## Test Plan

- AC-1, AC-2:
  - `PaymentItem.test.tsx` にカテゴリなしケースを追加し、カテゴリ badge が表示されず、日付、メモ、金額、button 操作が維持されることを確認する。
  - `PaymentList.test.tsx` で `category_id: null` の支払いが一覧に出るが `Unknown` / `Uncategorized` badge を出さないことを確認する。
- AC-3, AC-4, AC-5:
  - `fetchCategoryTotals.integration.test.ts` の未分類支払い期待を `Uncategorized` に更新し、複数未分類支払いが `key: "uncategorized"` に合算されることを確認する。
  - `CategoryTotals.test.tsx` の表示期待を `Uncategorized` に更新する。
- AC-6, AC-7:
  - 既存のカテゴリ紐付き表示テストを維持し、`Food`, `Daily Necessities` などが一覧とサマリーで表示されることを確認する。
- AC-8:
  - 実在カテゴリ名 `Unknown` と未分類集計のテストを、`Unknown` と `Uncategorized` が別行で表示される期待に更新する。
  - 一覧のカテゴリなしケースで新しい状態 label を出していないことを確認する。
- AC-9:
  - 差分確認は既存テストと diff review で行う。対象月、カテゴリ別合計、ピン留め優先順、フィルターは変更対象にしない。

Storybook browser-test は、browser-test tagged stories、`apps/web/.storybook-test/`、Storybook browser-test 設定に触らない限り不要。

## Build / Verify Goal への入力

- 実装対象:
  - `apps/web/src/features/payments/listPayment/PaymentList/PaymentList.tsx`
  - `apps/web/src/features/payments/listPayment/PaymentItem/PaymentItem.tsx`
  - `apps/web/src/features/summaryByMonth/CategoryTotals/fetchCategoryTotals.ts`
  - 上記に対応する test / story
- 守ること:
  - 一覧ではカテゴリ未紐付き支払いにカテゴリ表示を出さない。
  - サマリーでは未分類集計名を `Uncategorized` にする。
  - 実在カテゴリ名 `Unknown` と未分類集計を key / kind で混同しない。
  - `unknownCategory` の shared rename で対象外画面を巻き込まない。
  - 新規依存、DB/API/Auth 変更を追加しない。
- Verification:
  - Web application code changes なので、AGENTS.md の Web verification batch を実行する。
  - Storybook browser-test は browser-test 対象に触る場合だけ実行する。

## Risks / Follow-up

- `PaymentItem` の aria-label からカテゴリ部分を抜くため、アクセシブルな名前の期待をテストで明示する必要がある。
- `unknownCategory` が支払い詳細でも使われているため、shared rename は対象外影響が大きい。Build では一覧とサマリーの表示責務を分ける方針を維持する。
- `CategoryTotals` は `categoryName` だけでは実在カテゴリ名 `Unknown` と未分類集計の区別がつかない。表示では `Uncategorized` に変え、データ上は `key` / `kind` を維持して区別する。
- Requirements の対象外である不明参照、削除済みカテゴリ、取得失敗の新しい UI 状態が必要になった場合は停止し、Requirements へ戻す。
