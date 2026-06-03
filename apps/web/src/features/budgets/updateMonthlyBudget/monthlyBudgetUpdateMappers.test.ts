import { describe, expect, test } from "vite-plus/test"

import { toMonthlyBudgetUpdateArgs } from "./monthlyBudgetUpdateMappers"

describe("toMonthlyBudgetUpdateArgs", () => {
  test("月予算更新用の値をRPC引数に変換する", () => {
    expect(
      toMonthlyBudgetUpdateArgs({
        amount: 300000,
      }),
    ).toEqual({
      p_amount: 300000,
    })
  })
})
