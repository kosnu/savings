---
title: "Design / Plan: カテゴリ別予算機能を追加する"
doc_type: design
status: draft
area: repository
applies_to:
  - docs/ai-driven-development
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - design
  - category
  - budget
  - amount
  - month
  - transaction
when_to_read:
  - Issue #1440 のカテゴリ別予算実装方針を確認するとき
  - カテゴリ別予算の Build / Verify Goal を作成するとき
---

# Design / Plan: カテゴリ別予算機能を追加する

## 入力と前提

この Design は、最新の `docs/ai-driven-development/workspaces/1440-category-budget/requirements.md` を source of truth とする。既存 Design は根拠にしない。

現在有効な実装の確認は、現行挙動と既存パターンを把握する目的に限る。API migration にカテゴリ別予算の履歴はあるが、後続 migration で削除されているため、過去の形を復元すること自体は目的にしない。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `docs/ai-driven-development/**`, `apps/web/**`, `apps/api/**`
  - domain: `category`, `budget`, `amount`, `date`
  - activity: `write_design_doc`, `change_domain_ui`, `change_mutation`, `change_rpc`, `add_test`
  - topic: `category`, `budget`, `difference`, `month`, `transaction`, `responsive`, `msw`
- Selected:
  - `ai-driven.workflow`: Design / Plan の責務を守るため。
  - `ai-driven.issue-guidelines`: Requirements から実装方針へ展開し、Issue 以上の product scope を足さないため。
  - `documentation.policy`: Design artifact と front matter の責務を保つため。
  - `domain.category`: Book 所有、削除時の支払い未分類化、ピン留め境界を守るため。
  - `domain.monthly-budget`: 月初有効、予算なし状態、差分表示の precedent として参照するため。
  - `policy.temporal-data`: 過去月上書きと古い予算の暗黙復活を避けるため。
  - `policy.transaction-boundaries`: カテゴリと予算を同じ操作として扱う境界を決めるため。
  - `web.domain-ui-rules`: ドメイン値の主表示と状態差分を決めるため。
  - `web.design-rules`: フォーム、一覧、grid、responsive、DataList.Value 制約を守るため。
  - `web.component-structure`, `web.query-cache`, `web.test-policy`, `web.msw-handlers`: Build 時の配置、再取得、テスト/MSW方針を決めるため。
- Depends-on: `ai-driven.overview`, `architecture.overview`, `domain.amount`, `domain.date`
- Conflict decision: `domain.monthly-budget` は precedent として使う。月次予算や全体予算の仕様は変更しない。

## Current State

- カテゴリ作成は `create_category_with_pin` RPC で、カテゴリ名とピン留めを同一操作単位で保存している。
- カテゴリ更新は `update_category_with_pin` RPC で、カテゴリ名とピン留めを同一操作単位で保存している。
- カテゴリ削除は `categories` への delete で、支払いは未分類になり、ピン留めは削除に追従する。
- カテゴリ設定一覧は `categories` と `category_pins` を読み、予算状態を持たない。
- 支払い一覧サマリーはカテゴリ別支払い合計と未分類合計を表示し、カテゴリ別予算や差分を持たない。
- 過去の `category_budgets` と関連関数は後続 migration で削除されている。Build では現在の最終 schema を前提に再導入する。

## Adopted Approach

カテゴリ別予算は、Book とカテゴリに属する月次有効状態として扱う。設定画面では対象月を選ばせず、登録、更新、予算削除は現在月の月初から有効にする。支払い一覧サマリーは表示対象月の月末時点で有効なカテゴリ別予算を読み、対象月のカテゴリ別支払い合計との差分を表示する。

予算状態は `amount` と `none` の履歴で表す。金額ありは `amount` と0以上の整数を持つ。予算削除は `none` として保存し、古い金額あり予算が現在以降に暗黙復活しないようにする。予算行が存在しない読み取り状態は `unset` と呼ぶが、DB の保存状態にはしない。

カテゴリ削除は既存カテゴリ削除 semantics を維持する。削除されたカテゴリは通常のカテゴリ一覧や支払い一覧サマリーに出さない。関連支払いは既存どおり未分類になり、関連カテゴリ別予算は通常の有効表示から外れる。削除済みカテゴリの履歴UIは Issue #1440 の対象外とする。

カテゴリ作成、更新と予算変更は、ユーザーに1つの保存操作として見えるため、DB function / RPC の同一操作単位に閉じる。Web からカテゴリ保存後に別 request で予算保存する案は採用しない。

## Rejected Alternatives

- 現在値だけをカテゴリに直接持つ案: 対象月サマリーで過去月を読むと、現在の編集が過去月表示に反映されうる。
- 予算削除を物理削除だけで表す案: 最新行を消すと古い金額あり予算が現在状態として復活しうる。
- Web 層でカテゴリ保存と予算保存を連続実行する案: 片成功が完了済みに見え、AC-12 に合わない。
- 過去 migration の復元案: 現在の Requirements は過去実装の復元を目的にしていない。
- 主要値を `DataList.Value` 内に縦積みする案: カテゴリ、合計、差分の比較位置が揃わない。

## Data / API Design

新しい `category_budgets` は Book-owned data として再導入する。

- `id`
- `book_id`: `books(id)` への FK
- `category_id`: `categories(id)` への FK。カテゴリ削除時は通常の有効表示から外れる。
- `effective_from`: 対象月の月初日
- `effective_year`, `effective_month`: `effective_from` から決まる値
- `status`: `amount` または `none`
- `amount`: `status = amount` の場合だけ0以上の整数。`status = none` では `null`
- `created_at`, `updated_at`

制約:

- 同一 Book、カテゴリ、年、月の状態は重複できない。
- `amount` と `none` は `amount` の nullability で整合する。
- カテゴリと予算は同じ Book に属する。
- RLS は所属 Book のメンバーだけが read/write できる。

RPC / function 方針:

- create: category name、pin、budget input を1つの operation で保存する。
- update: category name、pin、budget input を1つの operation で保存する。
- delete: category delete と FK/DB 境界で pin と budget を通常有効表示から外す。
- read settings: 現在月の有効カテゴリ別予算状態をカテゴリ設定一覧に含める。
- read summary: 対象月末時点の有効カテゴリ別予算状態をカテゴリサマリーに含める。

保存規則:

- create の budget 空欄は予算行なし、読み取り時 `unset`。
- amount 入力は現在月の `amount` 状態として保存する。0は有効な金額。
- update の budget 空欄は予算削除意図として扱う。現在有効な金額あり予算がある場合は現在月の `none` を保存し、金額履歴がなければ `unset` のままにする。
- 対象月読み取りは、対象月末日以前に開始した最新状態をカテゴリごとに選ぶ。行なしは `unset`、最新 `none` は予算なし、最新 `amount` は予算あり。

## Temporal / Delete Semantics

- 基準月: 設定画面の登録、更新、削除は現在月の月初から有効。
- 過去月: 現在月以降の設定変更で過去月の予算状態を上書きしない。
- 現在月: 現在月の状態があれば更新し、なければ追加する。
- 未来月: 未来月指定 UI は追加しない。現在月から未来月へ効く状態として扱う。
- 予算削除: `none` 状態で表し、古い `amount` を復活させない。
- 未入力: row が存在しない `unset` として扱う。
- 0円: `amount = 0` の予算あり状態として扱う。
- カテゴリ削除: 通常のカテゴリ一覧、カテゴリサマリー、カテゴリ別予算表示から外す。削除済みカテゴリの履歴表示は追加しない。

## Operation Boundary

同一操作単位:

- Create category: category insert、pin insert/skip、budget amount insert/skip。
- Update category: category name update、pin insert/delete/skip、budget amount/none upsert/skip。
- Delete category: category delete、pin removal、category budget の通常有効表示からの除外。

境界は DB function / RPC または DB constraint/FK に閉じる。失敗時、Web は成功通知や成功後の一覧状態へ進めず、フォーム値または確認 modal を維持して失敗を表示する。

Mutation 後は React Query cache を直接書き換えず、カテゴリ一覧、カテゴリ選択、カテゴリサマリー系 query を invalidate / refetch する。

## Domain Value UI Decisions

| 値 | 主表示 | 補助/状態 |
| --- | --- | --- |
| カテゴリ | identity | ピンは補助状態。削除済みカテゴリは通常一覧に出さない。 |
| カテゴリ別予算額 | settings の基準値 | `unset`, `none`, `0`, error を区別する。 |
| 月合計額 | summary の実績値 | 予算有無で意味を変えない。 |
| 予算との差分 | judgment result | 金額あり予算でだけ計算する。 |
| 月/期間 | support | 支払い一覧サマリーの対象月を使う。 |
| 削除/予算削除 | state | 削除、予算なし、未入力、0円を区別する。 |

## Web UI Design

### Category create / update

- 既存の Name と Pin category の操作文脈に Budget 入力を追加する。
- Budget は任意の金額入力。空欄は create では `unset`、update では必要に応じて `none`、`0` は0円予算。
- 入力順は `Name`, `Budget`, `Pin category`。識別、基準値、表示設定の順にする。
- 送信中は既存と同じく入力と操作を disabled / loading にする。
- 保存成功時は既存と同じく modal を閉じる。保存失敗時はフォーム全体エラーを出し、入力値を消さない。

Major copy:

- Field label: `Budget`
- Budget helper: `Leave blank for no category budget.`
- Create submit: `Create`
- Update submit: `Save`
- Create failure: `Failed to create category.`
- Update failure: `Failed to save category.`

### Category delete

Delete は、カテゴリが消え、支払いが未分類になり、カテゴリ別予算も通常の有効予算として残らないことを確認文で伝える。

- Dialog title: `Delete this category?`
- Description: `Payments keep their records, but this category and its budget will no longer be available.`
- Success: `Category deleted successfully.`
- Failure: `Failed to delete category.`

### Category settings list

設定・管理一覧として扱う。PC 幅では header と row を同じ grid columns で共有し、`Name`, `Budget`, action column を横方向に揃える。header と body を別 Grid にする場合も、columns、gap、actions width を共通定義にする。

Budget column:

- `amount`: currency。0は `¥0`。
- `unset`: `Not set`
- `none`: `No budget`
- loading: row 幅を保つ skeleton。
- error: 通常行と別の error text。

Mobile では1レコードずつ読める行にする。Name と Budget の主要値を `DataList.Value` 内で縦積みしない。

### Summary by month

カテゴリサマリーは、カテゴリ、対象月合計額、予算との差分を同じ row の別セルとして表示する。既存の chunked `DataList` は、3つの主要値を揃える用途に合わないため置き換える。

- PC: grid/table-like row。列は `Category`, `Total`, `Difference`。金額列は右寄せ。
- Mobile: 複数 column chunk ではなく、1列の row list。各 row 内では同じ意味の値が同じ位置に揃う。
- `amount`: difference を表示する。
- `unset`: `Not set`
- `none`: `No budget`
- budget fetch / parse failure: `Failed`
- total fetch failure: 既存同様 section error。

Difference copy:

- 残額あり: `¥x left`
- 超過: `¥x over`
- 一致: `On budget`

## Impacted Modules

API:

- `apps/api/supabase/migrations/*`: `category_budgets` 再導入、constraints、RLS、RPC / database functions。
- 現行 `create_category_with_pin`, `update_category_with_pin` と同じ操作境界を維持する function layer。
- category delete の FK / cascade / RLS 周辺。

Web:

- `apps/web/src/features/categories/createCategory/**`
- `apps/web/src/features/categories/updateCategoryName/**`
- `apps/web/src/features/categories/deleteCategory/**`
- `apps/web/src/features/categories/listCategorySettings/**`
- `apps/web/src/features/categories/components/CategorySettingsList/**`
- `apps/web/src/features/categories/queryKeys.ts`
- `apps/web/src/features/summaryByMonth/CategoryTotals/**`
- `apps/web/src/features/summaryByMonth/queryKeys.ts`
- `apps/web/src/test/msw/handlers/**`
- `apps/web/src/types/database.types.ts`

## Test Plan

- AC-1, AC-2: create form/unit/integration/MSWで budget amount、空欄、0、pin limit を確認する。
- AC-3, AC-4: update form/unit/integrationで amount 更新、空欄削除、0、未入力との区別を確認する。
- AC-5: delete flowでカテゴリ削除後に予算が settings/summary に残らないことを確認する。
- AC-6, AC-7: settings listで `amount`, `unset`, `none`, loading, error を確認する。
- AC-8, AC-9, AC-10: summary fetch/schema/UIで total、difference、`Not set`, `No budget`, `Failed`, 0円予算を確認する。
- AC-11: CategoryTotals の mobile 1列 row list と、principal values を `DataList.Value` に縦積みしないことを確認する。
- AC-12: RPC / integration tests で category + pin + budget の片成功が完了済みに見えないことを確認する。
- AC-13: monthly/global budget、non-category budget、payment create/update に変更がないことを差分と既存テストで確認する。

Verification:

- Web application code changes: `pnpm run web:format`, then AGENTS.md Web verification batch。
- Storybook test: browser-test tagged stories or config を触る場合だけ。
- API: AGENTS.md に専用 command はない。migration と generated types を更新し、Web typecheck と integration tests で検出できる範囲を確認する。

## Risks / Follow-up

- 既存 DB 履歴にはカテゴリ別予算の作成と削除が含まれるため、Build では最終 schema から再導入する migration として扱う必要がある。
- 現在月の算出は date-only / local date ルールに合わせる必要がある。
- 削除済みカテゴリの過去履歴UIは対象外。将来必要になった場合は別 Requirements / Design が必要。
- RPC 名や引数は Build で既存 function layer との互換性を確認して決めてよいが、操作境界はこの Design から変えない。
