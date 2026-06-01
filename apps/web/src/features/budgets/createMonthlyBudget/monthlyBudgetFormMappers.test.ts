import { describe, expect, test } from "vite-plus/test"

import { toMonthlyBudgetCreateArgs } from "./monthlyBudgetFormMappers"

describe("toMonthlyBudgetCreateArgs", () => {
  test("月予算作成用の値をRPC引数に変換する", () => {
    expect(
      toMonthlyBudgetCreateArgs({
        targetMonth: new Date(2026, 2, 20),
        amount: 300000,
      }),
    ).toEqual({
      p_amount: 300000,
      p_effective_month: "2026-03-01",
    })
  })

  test("選択日の年月を使い、日付は月初日に丸める", () => {
    expect(
      toMonthlyBudgetCreateArgs({
        targetMonth: new Date(2025, 6, 31),
        amount: 75000,
      }),
    ).toEqual({
      p_amount: 75000,
      p_effective_month: "2025-07-01",
    })
  })
})
