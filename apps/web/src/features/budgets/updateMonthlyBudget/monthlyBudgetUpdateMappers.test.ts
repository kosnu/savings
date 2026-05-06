import { describe, expect, test } from "vite-plus/test"

import { toMonthlyBudgetUpdate } from "./monthlyBudgetUpdateMappers"

describe("toMonthlyBudgetUpdate", () => {
  test("月予算更新用の値をmonthly_budgets update payloadに変換する", () => {
    expect(
      toMonthlyBudgetUpdate({
        monthlyBudgetId: 42,
        amount: 300000,
      }),
    ).toEqual({
      amount: 300000,
    })
  })
})
