# 月単位画面の月送り範囲とフィルタ保持 Design Doc

## Source

- Requirements / PRD: `docs/ai-driven-development/workspaces/1492-month-navigation-v2/requirements.md`
- Related Issue: [#1492 月単位画面で前月・翌月へ移動しやすくする](https://github.com/kosnu/savings/issues/1492)
- Review source: [PR #1536 月送り操作を追加](https://github.com/kosnu/savings/pull/1536) の未解決 review threads

This Design treats the Requirements file as read-only. It does not update, reformat, rename, or append to the Requirements artifact or the previous `1492-month-navigation` generated artifacts.

## Rule Selection

作業分類:

- path: `docs/ai-driven-development/workspaces/1492-month-navigation-v2/design-doc.md`
- domain: web, ui, date, payment, category
- activity: write_design_doc, change_ui, change_date_logic, change_payment_ui, change_test
- topic: design-doc, month, date, payment, category, test

Selected refs:

- `docs/harness/rule-map.json`: 関連ドキュメント選択の入口。
- `docs/harness/policies/documentation-policy.md`: docs配下に新規Design Docを追加するため。
- `docs/ai-driven-development/workflow.md`: Requirements read-only と Design / Plan の責務確認。
- `docs/ai-driven-development/issue-guidelines.md`: Issue / Requirements / Design の役割境界確認。
- `docs/harness/domain/date.md`: 対象月を年と月の組み合わせで扱うため。
- `docs/harness/policies/temporal-data.md`: 対象月、月次状態、期間境界の扱いを確認するため。
- `docs/harness/domain/payment.md`: 月次支払い表示と支払いカテゴリの任意性を確認するため。
- `docs/harness/domain/category.md`: category filter とカテゴリ未設定の境界を確認するため。
- `docs/harness/domain/amount.md`: 月次支払い集計値の表示文脈を壊さないことを確認するため。
- `DESIGN.md`: Savings のブランド、密度、視覚トーンの上位方針。
- `apps/web/docs/policies/design-rules.md`: UI密度、button variant、文字階層、responsiveの判断。
- `apps/web/docs/policies/domain-ui-rules.md`: 対象年月、範囲、category filter のUI上の意味を決めるため。
- `apps/web/docs/policies/component-structure.md`: component追加または抽出が必要になった場合の配置確認。
- `apps/web/docs/policies/test-policy.md`: 任意項目も「存在しないこと」を期待値として検証するため。

Depends-on refs:

- `docs/ai-driven-development/workflow.md`: `ai-driven.issue-guidelines` の prerequisite。

Conflict decision: none.

## Requirements Summary

The next implementation must satisfy these Requirements constraints:

- 月送り可能範囲は 2022年1月 〜 2032年12月。
- 前月・翌月操作で範囲外へ移動できない。
- 範囲境界でも対象年月を理解でき、任意年月選択導線で再選択可能な状態に留まる。
- category filter がある場合は月送り後も保持する。
- category filter がない場合は月送り後に新規付与・残存しない。
- 将来案「最小は支払い情報の年月、最大は支払い情報の年月 + 1年」は扱わない。
- DB / API / auth / permission / data structure / aggregation logic は変更しない。

## Current Implementation Notes

Relevant current files:

- `apps/web/src/features/summaryByMonth/MonthSelector/MonthSelector.tsx`
- `apps/web/src/features/summaryByMonth/MonthSelector/MonthSelector.test.tsx`
- `apps/web/src/features/summaryByMonth/MonthSelector/MonthSelector.stories.tsx`
- `apps/web/src/components/inputs/MonthPicker/MonthPicker.tsx`
- `apps/web/src/features/payments/listPayment/paymentsSearchSchema.ts`
- `apps/web/src/features/payments/listPayment/PaymentCategoryFilter/PaymentCategoryFilter.tsx`
- `apps/web/src/features/payments/listPayment/paymentCategorySearch.test.ts`
- `apps/web/src/features/payments/listPayment/paymentsSearchSchema.test.ts`

Observed facts:

- `MonthSelector` reads `year` and `month` from `/payments` search params and updates them with `navigate({ search: (prev) => ({ ...prev, year, month }) })`.
- The previous / next month actions currently compute adjacent months without range checks.
- `MonthPicker` currently exposes year options from 2022 through 2032.
- `paymentsSearchSchema` treats `category` as optional. Valid values are positive category IDs or `none`.
- `PaymentCategoryFilter` clears category by writing `category: undefined` and preserves other search params with `prev` spread.
- `MonthSelector.test.tsx` has a shared `expectPaymentsSearch` helper that currently only checks `category` when an expected category is truthy.

## Design Decision

### Adopted Approach

Keep the change centered on `MonthSelector`.

Define a small local month range model:

- minimum month: January 2022
- maximum month: December 2032
- compare months by year/month only, normalized to the first day of the month

Use that range model to:

- determine whether `Previous month` is enabled;
- determine whether `Next month` is enabled;
- avoid calling month change navigation when a target month is outside the allowed range;
- keep `MonthPicker` and month-step navigation aligned with the same 2022-2032 year range.

Do not introduce dynamic range calculation from payment data. Do not change payment fetches, category fetches, DB, API, auth, or aggregation logic.

### Boundary Behavior

When the selected target month is `2022/01`:

- `Previous month` is disabled.
- activating the previous-month control must not update search params.
- `MonthPicker` still shows a selectable in-range year/month.

When the selected target month is `2032/12`:

- `Next month` is disabled.
- activating the next-month control must not update search params.
- `MonthPicker` still shows a selectable in-range year/month.

When the selected target month is inside the range:

- previous / next month buttons update only `year` and `month`;
- other existing search params, including `category`, are preserved exactly.

If implementation discovers that direct manual URL input can produce an out-of-range selected month that must be normalized for this requirement, stop. The Requirements only require month送り操作 not to move outside the range; direct URL normalization would add product scope.

### Search Param Behavior

Use the existing route search update pattern:

```ts
search: (prev) => ({ ...prev, year, month })
```

This preserves category when it exists and avoids creating category when it does not exist. The implementation must not add category-specific branching to month navigation.

### Test Helper Behavior

Update the `expectPaymentsSearch` helper so that category is always checked:

- expected category present -> actual category equals expected value;
- expected category absent -> actual category is `undefined`.

Do not use helper-level `if` to skip category verification. This follows `apps/web/docs/policies/test-policy.md`.

## Domain Value UI Decisions

### Target Month

- Purpose: identify which year/month the user is viewing.
- Primary UI: value itself, via existing year/month selection controls.
- Supporting context: the selected month is also the basis for monthly payment/summary data.
- Empty / invalid / loading: no new empty or loading state is introduced by this Design. If direct URL invalidity needs normalization beyond route schema, stop.

### Month Navigation Range

- Purpose: tell whether previous / next navigation is allowed.
- Primary UI: operation state. The boundary is expressed by disabling the out-of-range icon-only action.
- Supporting context: no additional visible range explanation is required in this iteration. The selected year/month remains visible through the existing selection controls.
- Copy / aria-label:
  - enabled previous action: `Previous month`
  - enabled next action: `Next month`
  - disabled controls keep the same aria-labels unless the UI library requires a different accessible description.

### Category Filter

- Purpose: preserve the user's filter context while moving across months.
- Primary UI: no additional month selector UI. The category filter remains owned by the existing payment category filter.
- Expected states:
  - category ID: preserved as the same search value;
  - `none`: preserved as `none`;
  - absent category: remains absent.

## Files And Modules

### Change Candidates

- `apps/web/src/features/summaryByMonth/MonthSelector/MonthSelector.tsx`
  - Add local allowed month range constants.
  - Add month comparison / boundary helpers near the component or as non-exported helpers.
  - Disable previous/next buttons at boundaries.
  - Prevent out-of-range month navigation from updating search params.

- `apps/web/src/features/summaryByMonth/MonthSelector/MonthSelector.test.tsx`
  - Update `expectPaymentsSearch` to always verify category presence or absence.
  - Add boundary tests for `2022/01` previous and `2032/12` next.
  - Add category absent tests for previous/next navigation.
  - Keep category present tests, including a valid category ID and optionally `none` if useful.

### No Change Expected

- `apps/web/src/components/inputs/MonthPicker/MonthPicker.tsx`
  - Current year options already cover 2022-2032.
  - Do not introduce new props unless implementation shows `MonthSelector` cannot stay aligned without changing `MonthPicker`.

- `apps/web/src/features/payments/listPayment/paymentsSearchSchema.ts`
  - No schema change needed. Category is already optional.

- DB / API / auth / payment/category data structures
  - No change.

## Alternatives

### Alternative A: Extend `MonthPicker` with min/max props

Rejected for this iteration. The current fixed `MonthPicker` year range already matches Requirements. Adding props would broaden the shared component surface without a current need. If future dynamic range requirements are confirmed, revisit this.

### Alternative B: Clamp out-of-range target month to nearest valid month

Rejected. Clamping can hide an attempted navigation and make the user's action less transparent. Boundary disabled state is clearer and keeps the selected month stable.

### Alternative C: Normalize all out-of-range URL search params

Rejected for this Design. Direct URL normalization is not required by the current Requirements and may affect routing semantics beyond month送り操作.

## Acceptance Criteria Mapping

- AC: 対象画面と対象外が明記されている
  - Design target is `/payments` month selector area. Other month-based screens remain out of scope unless Requirements are updated.
- AC: 前月・翌月へ移動したい理由と期待挙動
  - Previous / next buttons move one month inside 2022/01-2032/12 and preserve existing filters.
- AC: 対象年月、月送り操作、既存任意年月選択導線の関係
  - `MonthSelector` remains the owner of month stepping; `MonthPicker` remains the owner of arbitrary in-range year/month selection.
- AC: 2022年1月〜2032年12月 range
  - Add range constants and boundary checks in `MonthSelector`.
- AC: 範囲外へ月送りできない
  - Disable previous at 2022/01 and next at 2032/12; guard navigation against out-of-range target dates.
- AC: 範囲境界でも対象年月を理解し再選択可能
  - Boundary month stays selected in `MonthPicker`; no out-of-range search params are written by month stepping.
- AC: categoryあり保持
  - Maintain existing `prev` spread search update.
- AC: categoryなし非残存
  - Always assert category absence in tests when expected category is absent.
- AC: URL/search params and data boundary consistency
  - Only `year` and `month` are changed by month navigation. Data fetching remains driven by existing route search.
- AC: 将来案を含めない
  - No dynamic payment-data-derived month range.

## Test Plan

Update `MonthSelector.test.tsx`:

- Existing display and arbitrary month selection tests remain.
- Existing year rollover tests remain for in-range examples.
- Add lower boundary test:
  - initial `/payments?year=2022&month=1`
  - `Previous month` is disabled
  - search remains `{ year: "2022", month: "1", category: undefined }`
- Add upper boundary test:
  - initial `/payments?year=2032&month=12`
  - `Next month` is disabled
  - search remains `{ year: "2032", month: "12", category: undefined }`
- Add category absent assertion to existing previous/next tests:
  - expected category omitted must assert actual category is `undefined`.
- Keep category present test:
  - previous/next preserve `category=10`.
- Add or keep `none` category preservation only if it fits existing test setup without widening scope.

No Storybook browser-test is required unless the implementation changes `browser-test` tagged stories, `apps/web/.storybook-test/`, or Storybook browser-test config.

## Verification For Build / Verify

Application code changes are expected in Build / Verify, so run AGENTS.md Web verification batch:

- `pnpm run web:format`
- then in the verification batch:
  - `pnpm run web:lint`
  - `pnpm run web:format-check`
  - `pnpm run web:typecheck`
  - `pnpm run web:test:unit-integration`

Storybook browser-test is not expected.

This Design Doc creation itself is docs-only, so no app verification command is required for this phase.

## Risks

- Boundary disabled state must be based on normalized year/month values, not full `Date` timestamps.
- Current fallback behavior uses `new Date()` when search params are absent. If the fallback month is outside 2022/01-2032/12 in future runtime years, implementation may need a bounded fallback. If this affects Requirements interpretation, stop before broadening scope.
- `category` may be `undefined`, a positive ID string, or `none`; tests must avoid truthiness checks that skip verification.
- Changing `MonthPicker` directly could affect monthly budget month selection. Avoid shared component changes unless necessary.

## Rule / Policy Compliance Check

- Workflow: creates a new Design Doc from the latest Requirements and treats Requirements as read-only.
- Issue guidelines: keeps implementation detail in Design, not Issue/Requirements, and does not expand product scope.
- Date / temporal rules: treats target month as year/month and keeps the range explicit.
- Payment / category rules: treats category as an optional filter and does not change payment/category data meaning.
- Web design / domain UI rules: uses operation state for range boundary and leaves concrete visual styling to existing UI patterns.
- Component structure: no new component is required by the preferred design.
- Test policy: requires category absence to be asserted, not skipped.
