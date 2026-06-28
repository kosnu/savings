import { describe, expect, test } from "vite-plus/test"

import { toMonthlyBudgetUpdateArgs } from "./monthlyBudgetUpdateMappers"

describe("toMonthlyBudgetUpdateArgs", () => {
  test("月予算更新用の値をRPC引数に変換する", () => {
    expect(
      toMonthlyBudgetUpdateArgs({
        targetMonth: new Date(2026, 2, 20),
        currentMonth: new Date(2026, 2, 20),
        amount: 300000,
      }),
    ).toEqual({
      p_target_month: "2026-03-01",
      p_current_month: "2026-03-01",
      p_amount: 300000,
    })
  })

  test("選択日の年月を使い、日付は月初日に丸める", () => {
    expect(
      toMonthlyBudgetUpdateArgs({
        targetMonth: new Date(2025, 6, 31),
        currentMonth: new Date(2026, 2, 20),
        amount: 75000,
      }),
    ).toEqual({
      p_target_month: "2025-07-01",
      p_current_month: "2026-03-01",
      p_amount: 75000,
    })
  })
})
