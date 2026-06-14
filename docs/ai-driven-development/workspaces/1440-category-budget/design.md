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

この Design は、working tree 最新の `docs/ai-driven-development/workspaces/1440-category-budget/requirements.md` を source of truth として作り直す。過去にこのブランチで作った `design.md`、カテゴリ別予算の実装差分、migration、tests、MSW、types、PR #1472 本文、検証結果、過去 Goal 出力は入力にしない。

既存実装の確認は、現在有効な挙動と影響範囲を把握する目的に限定する。過去の `category_budgets` migration は後続 migration で削除済みのため、現在機能の根拠にも実装形の根拠にも使わない。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `docs/ai-driven-development/**`, `apps/web/**`, `apps/api/**`
  - domain: `category`, `budget`, `amount`, `date`
  - activity: `write_design_doc`, `change_domain_ui`, `review_data_consistency`
  - topic: `category`, `budget`, `difference`, `month`, `transaction`, `responsive`
- Selected:
  - `ai-driven.workflow`: Design / Plan の成果物と Stop 条件を確認するため。
  - `ai-driven.issue-guidelines`: Requirements から実装方針へ展開し、Issue 以上の product scope を足さないため。
  - `documentation.policy`: Design artifact の front matter と責務を保つため。
  - `domain.category`: Book 所有、名前制約、削除時の支払い未分類化、ピン留め境界に合わせるため。
  - `domain.monthly-budget`: 月初有効、予算なし状態、差分表示の precedent を比較材料にするため。
  - `policy.temporal-data`: 現在有効状態、過去表示、解除後の暗黙復活を決めるため。
  - `policy.transaction-boundaries`: カテゴリと予算を同じ操作として扱う境界を決めるため。
  - `web.domain-ui-rules`: ドメイン値の目的、0、未設定、解除、取得失敗の表示差分を決めるため。
  - `web.design-rules`: 一覧、フォーム、余白、responsive、`DataList.Value` の禁止事項を守るため。
  - `web.component-structure`: Build で Web component を追加・分割する場合の配置を守るため。
  - `web.query-cache`: mutation 後の反映を cache 直接変更ではなく再取得・無効化で行うため。
  - `web.test-policy`, `web.msw-handlers`: API 境界を通る回帰テストと MSW handler の責務を決めるため。
- Depends-on: `ai-driven.overview`, `domain.amount`, `domain.date`, `architecture.overview`
- Conflict decision: `domain.monthly-budget` は precedent として使う。カテゴリ別予算を月次予算や全体予算の再設計へ広げない。

## Current State

- カテゴリ作成は `create_category_with_pin` RPC で、カテゴリ名とピン留めを同一操作単位で保存している。
- カテゴリ更新は `update_category_with_pin` RPC で、カテゴリ名とピン留めを同一操作単位で保存している。
- カテゴリ削除は `categories` の削除で、支払いの `category_id` は FK により `null` になり、ピン留めはカテゴリ削除に追従して消える。
- カテゴリ一覧は `categories` と `category_pins` だけを読み、予算状態は持たない。
- 支払い一覧サマリーはカテゴリ名、対象期間の支払い合計、ピン留め、未分類合計を扱い、カテゴリ別予算や差分は扱わない。
- 現行のカテゴリサマリー UI は `DataList` を複数 chunk に分ける構成で、カテゴリ、合計額、差分の3値を横方向に揃える用途にはそのまま使わない。

## Adopted Approach

カテゴリ別予算は、Book とカテゴリに属する月次有効状態として再導入する。設定画面では対象月を選ばせず、作成、更新、解除は「現在月の月初」から有効にする。支払い一覧サマリーは表示対象月の月末時点で有効なカテゴリ別予算を読み、対象月のカテゴリ別支払い合計との差を表示する。

予算は `amount` と `none` の状態を持つ履歴として保存する。新規カテゴリを予算なしで作る場合は予算行を作らず `unset` として扱う。設定済み予算を解除する場合は、現在月の `none` 状態を保存する。これにより、過去の金額あり予算が現在以降に暗黙復活しない。

カテゴリ削除は既存のカテゴリ削除 semantics を維持する。削除されたカテゴリは通常のカテゴリ一覧や支払い一覧サマリーに出さない。関連支払いは既存どおり未分類になり、関連カテゴリ別予算はカテゴリ削除に追従して通常の有効予算から外す。削除済みカテゴリの過去履歴表示は Issue #1440 の scope に含めない。

カテゴリ作成、更新、削除と予算変更は、ユーザーに1つの操作として見えるため DB function / RPC で同一操作単位に閉じる。Web からカテゴリ保存後に別 request で予算保存する案は採用しない。

## Rejected Alternatives

- 現在値だけをカテゴリに直接持つ案: 対象月サマリーで過去月を読むと現在の編集が過去月に反映され、Temporal Data Policy に合わない。
- 解除を物理削除だけで表す案: 最新の金額行を消すと古い金額行が現在状態として復活しうる。
- Web 層でカテゴリ保存と予算保存を連続実行する案: 片成功が完了済みに見え、AC-12 と Transaction Boundaries に合わない。
- 旧 `category_budgets` migration の復元案: 後続 migration で削除済みの過去実装であり、現在の Book 境界と同一操作境界を前提に再設計する必要がある。
- 既存 `CategoryTotals` の `DataList.Value` に合計額と差分を縦積みする案: `web.design-rules` の `DataList.Value` 禁止事項に反する。

## Data / API Design

### `category_budgets`

新しい `category_budgets` は現在の Book 境界に合わせる。

- `id`
- `book_id`: `books(id)` への FK。既定は authenticated user の default book。
- `category_id`: `categories(id)` への FK。`on delete cascade` とし、カテゴリ削除時は通常の有効予算から外れる。
- `effective_from`: 対象月の月初日。
- `effective_year`, `effective_month`: `effective_from` から生成。
- `status`: `amount` または `none`。
- `amount`: `status = amount` の場合だけ 0 以上の整数相当。`status = none` では `null`。
- `created_at`, `updated_at`

制約:

- `unique (book_id, category_id, effective_year, effective_month)`
- `status in ('amount', 'none')`
- `(status = 'amount' and amount is not null) or (status = 'none' and amount is null)`
- category は同じ Book に属すること。
- RLS は member book のカテゴリ別予算だけを read/write できること。

`unset` は row が存在しない読み取り状態であり、保存状態としては `status` に含めない。

### RPC / Function

Build では既存 RPC を置き換えるか、新しい RPC 名にするかを migration 互換性に合わせて決めてよい。ただし Web から見える操作境界は次に固定する。

- create: category name、pin、budget input を1つの RPC で保存する。
- update: category name、pin、budget input を1つの RPC で保存する。
- delete: category、pin、category budget の通常有効状態からの除外を1つの RPC で扱う。
- read list: カテゴリ設定一覧は現在月の有効カテゴリ別予算状態を含む。
- read summary: 対象月サマリーは対象月末時点で有効なカテゴリ別予算状態を含む。

予算保存 helper の挙動:

- input が金額ありなら、現在月の row を `amount` として upsert する。0 は有効な金額として保存する。
- create で input が空なら予算 row は作らず `unset` とする。
- update で input が空なら、現在有効な金額あり予算がある場合だけ現在月の `none` row を upsert する。金額履歴がない場合は `unset` のままにする。
- 同じ現在月に `none` row があり、金額ありへ戻す場合は同じ row を `amount` に更新してよい。
- 対象月読み取りは、対象月末日以前に開始した最新 row を category ごとに選ぶ。row なしは `unset`、最新 row が `none` は `none`、`amount` は予算あり。

## Temporal / Delete Semantics

- 基準月: 設定画面の作成、更新、解除は現在月の月初から有効。
- 過去月: 現在月以降の設定変更で過去月の予算状態を上書きしない。
- 現在月: 現在月 row があれば更新し、なければ現在月 row を追加する。
- 未来月: Issue #1440 では未来月を指定する UI を追加しない。現在月から未来月へ効く状態として扱う。
- 解除: `none` row で表し、古い `amount` row を復活させない。
- 未設定: row が存在しない `unset` として扱う。
- 0円: `amount = 0` の予算あり状態として扱う。
- カテゴリ削除: 通常の有効カテゴリ、カテゴリ一覧、カテゴリサマリーから外す。削除済みカテゴリの履歴表示は追加しない。

## Operation Boundary

同一操作単位:

- Create category: category insert、pin insert/skip、category budget amount insert/skip。
- Update category: category name update、pin insert/delete/skip、category budget amount/none upsert/skip。
- Delete category: category delete、pin removal、category budget の通常有効表示からの除外。

境界は DB function / RPC で閉じる。RPC が失敗した場合、Web は成功 snackbar や成功後の一覧状態へ進めず、フォーム値または確認 modal を維持して失敗を表示する。

Mutation 後は React Query cache を直接書き換えず、カテゴリ一覧、カテゴリ選択、カテゴリサマリー系 query を invalidate / refetch する。

## Domain Value UI Decisions

| 値 | 目的 | 主表示 | 補助 / 状態 |
| --- | --- | --- | --- |
| カテゴリ | 対象を識別したい | identity | ピンは補助状態。削除済みカテゴリは通常一覧に出さない。 |
| カテゴリ別予算額 | 基準値を管理し実値を確認したい | category settings では primary value | `unset`, `none`, `0`, error を区別する。 |
| 月合計額 | 対象月の実績を知りたい | summary の primary value | 予算有無で合計値の意味を変えない。 |
| 予算との差 | 比較し残り/超過/一致を判断したい | judgment result | 金額あり予算でだけ計算する。 |
| 月 / 期間 | 比較対象を理解したい | support | 支払い一覧サマリーの対象月を使う。 |
| 削除 / 解除状態 | 後続表示に残るか判断したい | state | 解除は `none`、未設定は `unset`、削除は通常一覧から除外。 |

## Web UI Design

### Category create / update

- 既存の Name と Pin の操作文脈に Budget 入力を追加する。
- Budget は任意の金額入力。create の空は `unset`、update の空は必要に応じて `none`、`0` は 0円予算として扱う。
- 入力順は `Name`, `Budget`, `Pin category` とする。カテゴリ名が識別、予算が基準値、ピンが表示設定であるため。
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

Major copy:

- Dialog title: `Delete this category?`
- Dialog description: `Payments keep their records, but this category and its budget will no longer be available.`
- Success: `Category deleted successfully.`
- Failure: `Failed to delete category.`

### Category settings list

設定一覧は「設定・管理一覧」として扱う。PC 幅では header と row を同じ grid columns にし、`Name`, `Budget`, action column を横方向に揃える。action column は見出し文言を置かない空 header として列構造だけ保つ。

Budget column:

- `amount`: currency。`0` は `¥0` と表示する。
- `unset`: `Not set`
- `none`: `No budget`
- loading: row 幅を保つ skeleton。
- error: 既存の list error と同等に、通常行とは別の error text。

Mobile では1レコードずつ読める行にする。操作は行末にまとめ、Name と Budget の主値を `DataList.Value` 内で縦積みしない。

### Summary by month

カテゴリサマリーは、カテゴリ、対象月合計額、予算との差を同じ row の別セルとして表示する。既存の chunked `DataList` 表示は、3つの主要値を揃える用途に合わないため置き換える。

- PC: table-like または grid row。列は `Category`, `Total`, `Difference`。金額列は右寄せ。
- Mobile: 複数 column chunk ではなく、1列の row list。各 row 内では category、total、difference を別セルとして扱い、同じ意味の値が行ごとに同じ位置へ揃うようにする。
- `amount`: difference を表示する。
- `unset`: difference cell は `Not set`。
- `none`: difference cell は `No budget`。
- budget fetch / parse failure: `Failed`。`0` 差や予算なしとして表示しない。
- total fetch failure: 既存同様、summary section の error として扱う。

Difference copy:

- 残額あり: `¥x left`
- 超過: `¥x over`
- ちょうど一致: `On budget`

## Impacted Modules

API:

- `apps/api/supabase/migrations/*`: `category_budgets` 再導入、constraints、RLS、RPC / database functions。
- `apps/api/supabase/migrations/*add_category_pin_functions*`: 既存 create/update category RPC の置き換えまたは新 RPC 追加。
- category delete policy / function 周辺。

Web:

- `apps/web/src/features/categories/createCategory/**`
- `apps/web/src/features/categories/updateCategoryName/**`
- `apps/web/src/features/categories/deleteCategory/**`
- `apps/web/src/features/categories/listCategorySettings/**`
- `apps/web/src/features/categories/components/CategorySettingsList/**`
- `apps/web/src/features/categories/queryKeys.ts`
- `apps/web/src/features/summaryByMonth/CategoryTotals/**`
- `apps/web/src/features/summaryByMonth/queryKeys.ts`
- `apps/web/src/test/msw/handlers/**` if API-boundary component tests require new handlers.

## Test Plan

- AC-1, AC-2: create form validation and mutation tests for amount, blank budget, 0 budget, and create RPC payload.
- AC-3, AC-4: update form tests for set, change, clear, unset, `0`, and no-op name/pin changes.
- AC-5, AC-12: delete mutation / RPC tests show category and budget removal happen as one operation; failure does not show success.
- AC-6, AC-7: category settings list tests for `amount`, `unset`, `none`, `0`, loading, error.
- AC-8, AC-9, AC-10: category summary fetch/mapper tests for monthly totals and budget difference; no budget, 0 budget, and fetch failure are not rendered as 0 difference.
- AC-11: CategoryTotals component test for mobile one-column row list and no chunked multi-column layout.
- AC-13: regression tests or affected existing tests for monthly budget, global budget, non-category budgets, and payment create/update flows should not change behavior.
- MSW handlers should model API response shape only. Query/filter correctness should be asserted in tests rather than duplicated as handler business logic.

## Build Notes

- Use existing amount parsing conventions: trim string input, allow blank for optional amount, reject negative and decimal input, store integer amount.
- Use current month from database functions for write effective month to avoid client timezone drift.
- Use date-only target month boundaries for summary reads.
- Keep Web component additions inside component directories with `index.ts` when components are added or extracted.
- Do not add optimistic cache updates. Invalidate/refetch affected category and summary queries after success.

## Risks / Open Questions

- DB/RPC changes are required. This is within Requirements technical consideration, but Build must stop if implementation needs auth or permission behavior beyond member-book access.
- Category deletion currently removes category identity from historical payment categorization. This Design keeps that existing behavior and does not add deleted-category history UI.
- Future-month-specific category budget editing is intentionally out of scope because Requirements does not add target-month input to category settings.

## Verification

Docs-only Design work. App verification is not required.

Manual checks:

- Design traces to latest Requirements AC-1..AC-13.
- Previous `design.md`, prior branch implementation, PR #1472, prior verification, and prior Goal outputs were not used as evidence.
- `web.design-rules` additions are reflected: no `DataList.Value` vertical stacking of principal values; grid/table-like lists align same-meaning columns.
- Build has enough input for temporal model, operation boundary, data/API direction, UI decisions, copy, impacted modules, tests, and risks.
