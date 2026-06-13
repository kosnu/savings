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
  - design-doc
  - category
  - budget
  - amount
  - month
when_to_read:
  - Issue #1440 の Build / Verify Goal を作成するとき
  - カテゴリ別予算の実装方針、影響範囲、検証方針を確認するとき
---

# Design / Plan: カテゴリ別予算機能を追加する

## Goal

`docs/ai-driven-development/workspaces/1440-category-budget/requirements.md` を source of truth として、カテゴリ別予算の実装方針、影響範囲、UI 判断、データ操作境界、検証方針を定義する。この Design Doc では実装しない。

Issue #1440 以上の UI state、追加指標、詳細内訳、カテゴリ以外の予算、月次予算・全体予算の仕様見直しは扱わない。

## Inputs

- Requirements / PRD: `docs/ai-driven-development/workspaces/1440-category-budget/requirements.md`
- Related Issue: https://github.com/kosnu/savings/issues/1440
- Rule map: `docs/harness/rule-map.json`
- Selected docs:
  - `docs/harness/domain/category.md`
  - `docs/harness/domain/monthly-budget.md`
  - `docs/harness/domain/amount.md`
  - `docs/harness/domain/date.md`
  - `docs/harness/policies/temporal-data.md`
  - `docs/harness/policies/transaction-boundaries.md`
  - `apps/web/docs/policies/domain-ui-rules.md`
  - `apps/web/docs/policies/design-rules.md`
  - `apps/web/docs/policies/component-structure.md`

## Current Implementation Summary

- Category settings currently support category creation, name update, delete, and pin display in `apps/web/src/features/categories`.
- Category creation and name/pin update use RPCs:
  - `create_category_with_pin`
  - `update_category_with_pin`
- Category deletion currently deletes from `categories` directly through Supabase query builder.
- Category settings list currently reads `categories` and `category_pins` only.
- Category total summary currently reads `categories`, `category_pins`, and `payments`, then returns category name, total amount, pinned state, and uncategorized total.
- `CategoryTotals` currently renders category totals in chunks with default `chunkSize = 2`, `initialVisibleCount = 3`, and a Show more / Show less toggle.
- Past `category_budgets` migrations and `create_category_with_budget` / `update_category_with_budget` functions existed, but `20260528000000_remove_category_budgets.sql` removes them. Treat those files as historical evidence, not current behavior.
- Monthly budget currently uses `status = 'amount' | 'none'`, nullable `amount`, and RPCs such as `get_effective_monthly_budget`, `create_monthly_budget`, `update_current_monthly_budget`, and `remove_current_monthly_budget`.

## Rule Selection

- Classification:
  - path: `docs/ai-driven-development/**`, future `apps/web/**`, future `apps/api/**`
  - domain: `category`, `budget`, `amount`, `date`
  - activity: `write_design_doc`, `change_domain_ui`, `review_data_consistency`
  - topic: `category`, `budget`, `difference`, `month`, `transaction`, `responsive`
- Selected:
  - `domain.category`: category lifecycle, Book ownership, payment/pin side effects.
  - `domain.monthly-budget`: precedent for amount/none/unset and budget difference, without inheriting product scope blindly.
  - `policy.temporal-data`: current state vs past display, delete/unset semantics, no implicit revival.
  - `policy.transaction-boundaries`: category and budget changes are one user operation.
  - `web.domain-ui-rules`: domain value purpose and state distinction.
  - `web.design-rules`: settings list, forms, dialogs, summary layout, responsive behavior, copy.
  - `web.component-structure`: required if Build adds category budget fields/components.
- Depends-on:
  - `ai-driven.workflow`, `ai-driven.overview`, `ai-driven.issue-guidelines`, `documentation.policy`, `domain.amount`, `domain.date`, `architecture.overview`.
- Conflict decision:
  - Monthly budget rules are used as precedent for temporal data and status semantics. They do not expand category budget into monthly/global budget redesign.

## Adopted Approach

Reintroduce category budgets as Book-owned, category-scoped, month-effective budget state records with explicit `amount` and `none` states.

At design level, the effective category budget for a summary target month is the latest category budget state whose `effective_from` is on or before the target month end, scoped by Book and category. A state with `status = 'amount'` and an integer `amount` means the category has a budget for that month. A state with `status = 'none'` means the category has no category budget from that effective month until a later amount state appears.

Category budget update and unset operations apply from the current month forward. Past target months keep the state that was effective for that month. This follows the temporal data policy and avoids changing historical summaries when the user edits the current category settings.

Category deletion should make the category's budget unavailable for future category settings and future summary display. Because the existing category rule sets related payments to uncategorized on delete, deleted category budgets do not need to appear in summary as deleted-category historical labels for this PRD. If future requirements need deleted-category history, that must be a separate PRD because it changes the category deletion model.

## Rejected Alternatives

- **Current-value-only category budget**: simpler, but changing a category budget would rewrite the meaning of past summaries and cannot satisfy the temporal policy once summary is month-scoped.
- **Reuse monthly budget table for categories**: mixes global monthly budget with category budget and violates the PRD out-of-scope boundary.
- **Direct table writes from Web for multi-step operations**: risks partial success across category, pin, and budget updates. RPC/database function boundaries better match existing `create_category_with_pin` and `update_category_with_pin`.
- **Add category budget state labels to the UI**: not required by PRD. The UI must distinguish value states, but should not add extra budget state labels as product copy.
- **Show budget amount as an extra primary summary metric**: PRD asks for category name, monthly total, and difference. Budget amount may be supporting context only if needed to explain the difference.

## Data And API Design

### Database

Add a new `category_budgets` table in a future migration:

- `id bigint generated always as identity primary key`
- `book_id bigint not null references books(id) on delete cascade`
- `category_id bigint not null references categories(id) on delete cascade`
- `effective_from date not null`
- generated `effective_year` and `effective_month`
- `status text not null` with allowed values `amount` and `none`
- `amount integer null`
- timestamps consistent with existing budget tables

Constraints:

- `unique (book_id, category_id, effective_year, effective_month)`
- `status = 'amount'` requires `amount is not null`
- `status = 'none'` requires `amount is null`
- `amount` follows amount domain rules: integer and `>= 0`
- category and category budget must belong to the same Book

Indexes:

- `(book_id, category_id, effective_from desc)` for effective-state lookup

RLS:

- authenticated users can read and mutate only budgets belonging to Books they can access.
- Use the same Book membership pattern as current Book-owned tables.

### RPCs

Use RPC/database functions for user-visible operations that combine category, pin, and budget changes:

- `create_category_with_pin_and_budget(p_category_name text, p_pinned boolean, p_budget_amount integer nullable)`
  - creates category
  - creates pin when requested
  - inserts `category_budgets` amount state for current month when `p_budget_amount` is not null
  - inserts no category budget row when budget is not provided
- `update_category_with_pin_and_budget(p_category_id bigint, p_category_name text, p_pinned boolean, p_budget_amount integer nullable, p_budget_action text)`
  - updates category name and pin
  - `p_budget_action = 'keep' | 'set' | 'unset'`
  - `set` writes or updates current-month `amount` state
  - `unset` writes or updates current-month `none` state
  - `keep` leaves category budget state unchanged
- `delete_category_with_budget(p_category_id bigint)`
  - deletes the category through the same operation boundary
  - category budget rows cascade by FK
  - payments and pins keep the existing category-domain side effects
- `get_effective_category_budgets(p_target_month date)`
  - returns effective category budget state for categories in the authenticated default Book for the target month
  - returns amount states and omits or explicitly marks none/unset states according to Web mapper needs

Build may choose exact function names, but must keep one operation boundary per user-visible create/update/delete action and update generated Supabase types.

## Web Design

### Category Settings

Affected areas:

- `apps/web/src/features/categories/createCategory/*`
- `apps/web/src/features/categories/updateCategoryName/*`
- `apps/web/src/features/categories/deleteCategory/*`
- `apps/web/src/features/categories/listCategorySettings/*`
- `apps/web/src/features/categories/components/CategorySettingsList/*`
- category tests, stories, and MSW handlers

Create category form:

- Add one optional budget amount field after category name and before pin.
- Label: `Budget`
- Helper text: `Optional monthly budget for this category.`
- Empty input means no category budget.
- `0` is a valid 0 yen budget, not unset.
- Submit button remains `Create`.
- Form-level server error continues to use an alert.

Update category form:

- Add the same budget field after name.
- Initial value shows current effective amount for the current month when status is amount.
- Empty value means the user wants to unset the category budget from the current month.
- If current status is none/unset, the field starts empty.
- Submit button remains `Save`.
- The design does not add visible state labels such as "No budget" or "Unset". Empty field plus helper text is enough.

Category settings list:

- Keep the list as a settings/management grid.
- Add a budget value as supporting information for each category.
- Desktop grid: category name, budget, actions.
- Mobile: category name and budget stack in the main cell; actions remain at row end.
- Display budget amount with existing currency formatting when set.
- Display a weak dash `-` when unset/none. Do not introduce a new state label.
- Keep pin badge as existing behavior.

Delete category:

- Existing delete confirmation can be reused, but copy must make the budget side effect clear.
- Major copy: `Delete this category and its budget?`
- Supporting copy: `Payments using this category will become uncategorized.`
- Delete action remains destructive.

### Summary

Affected areas:

- `apps/web/src/features/summaryByMonth/CategoryTotals/*`
- summary query keys and MSW category handlers

Data shape for each category total should include:

- `budgetStatus: 'amount' | 'none' | 'unset'`
- `budgetAmount: number | null`
- `budgetDifference: number | null`

Difference:

- `budgetDifference = budgetAmount - totalAmount` only when `budgetStatus = 'amount'`.
- non-amount states return `null`; do not render `0` difference.
- `0` difference is an explicit equal state.

Summary display:

- Show category identity and monthly total as the primary key-value row.
- Show budget difference as supporting text in the value area.
- Major copy:
  - Remaining: `{amount} left`
  - Over: `{amount} over`
  - Equal: `On budget`
  - Budget unavailable: render nothing for difference
  - Fetch error for budget information: `Failed`
- Do not show extra budget amount as a separate primary metric in the summary.
- Keep Show more / Show less behavior.
- Mobile summary must use 1 column. Use responsive `columns={{ initial: "1", sm: String(chunkSize) }}` or an equivalent token-based approach.

## Domain Value UI Decisions

| Value | Purpose | Primary shown | Supporting context | States |
| --- | --- | --- | --- | --- |
| Category | identify target | identity | pin remains existing state | deleted categories are not shown as normal rows |
| Budget amount | know/manage configured value | value in settings | supports summary difference | unset/none shown as `-` in settings |
| Monthly category total | know month total | value | category identity | empty category total remains existing 0 behavior |
| Difference | judge remaining/over/equal | judgment result | based on budget amount and total | none/unset/unavailable render no difference; error shows `Failed` |
| Month/period | know comparison basis | target summary month | current-month settings edits affect current month forward | past/current behavior documented in temporal decision |
| Delete state | know downstream effect | deletion confirmation copy | payments become uncategorized | budget no longer appears as active |

## Impacted Files And Modules

Likely API changes:

- new migration under `apps/api/supabase/migrations/`
- generated `apps/web/src/types/database.types.ts`

Likely Web changes:

- category create/update schema, mappers, forms, hooks, RPC callers
- category settings item fetcher, type, list UI, tests, stories, MSW handlers
- category delete RPC caller and hook tests
- summary category totals fetcher, mapper/type, UI, tests, stories, MSW handlers
- possibly shared budget amount field component under a sibling component directory per component structure policy

No changes expected:

- payment create/update flows
- monthly budget UI semantics
- global budget semantics
- auth model or Book ownership model beyond category budget RLS matching existing patterns

## Test Plan

- API migration tests or SQL verification should cover:
  - `category_budgets` constraints for `amount` and `none`
  - same Book membership between category and budget
  - effective category budget lookup by target month
  - set/unset does not revive older amount state for current/future months
  - create/update/delete RPC partial-success boundaries
- Web unit/integration tests should cover:
  - create category with empty budget and with 0/positive budget
  - update category keep/set/unset budget
  - category settings list renders amount or `-`
  - delete category uses RPC and invalidates category/payment/summary queries
  - summary renders left/over/on-budget and hides difference for none/unset
  - budget fetch error shows `Failed`
  - mobile summary uses one column
- Existing tests for pin limit, category name validation, Show more / Show less, monthly budget usage, and payment category behavior should remain valid.
- Storybook browser-test is required only if existing browser-test tagged stories or Storybook browser-test config are changed.

## Acceptance Criteria Mapping

- AC-1, AC-2: create category form + create RPC with optional budget.
- AC-3, AC-4: update category form + action `keep/set/unset`, amount/none state constraints.
- AC-5: delete RPC + cascade/operation boundary + summary/category invalidation.
- AC-6, AC-7: category settings list budget value or dash.
- AC-8, AC-9, AC-10: summary fetcher and display difference semantics.
- AC-11: responsive 1-column summary on mobile.
- AC-12: RPC boundaries and disabled/loading/error form behavior.
- AC-13: scoped no-change list and regression tests for monthly/global/payment flows.

## Risks And Follow-up Checks

- Supabase generated types must be refreshed after migrations/RPCs are added.
- The summary query may become too complex if built only with nested PostgREST selects. If so, prefer an RPC for effective category totals with budgets rather than spreading effective-state logic across Web code.
- Current category deletion makes payments uncategorized. This design intentionally does not preserve deleted category budget rows for historical category labels.
- Budget amount input copy is intentionally minimal; do not add extra visible state labels unless a future PRD asks for them.
- If implementation discovers that category budget period semantics cannot be represented with current-month-forward state rows, stop and revise Requirements / PRD or Design before building.

## Verification

- App commands: none; this is a Design Doc only.
- Manual check performed by comparing this Design Doc against Requirements / PRD, selected rule-map documents, Done, and Stop conditions.
