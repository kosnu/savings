import { expect, test } from "vite-plus/test"

import { toMonthlyBudgetUpdateArgs } from "./monthlyBudgetUpdateMappers"

test("月予算IDと金額をRPC引数に変換する", () => {
  expect(
    toMonthlyBudgetUpdateArgs({
      monthlyBudgetId: 42,
      amount: 300000,
    }),
  ).toEqual({
    p_monthly_budget_id: 42,
    p_amount: 300000,
  })
})
