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

  test.each([
    { targetMonth: new Date(2022, 0, 1), effectiveMonth: "2022-01-01" },
    { targetMonth: new Date(2032, 11, 31), effectiveMonth: "2032-12-01" },
  ])("許容範囲の端点の月 $effectiveMonth を変換できる", ({ targetMonth, effectiveMonth }) => {
    expect(toMonthlyBudgetCreateArgs({ targetMonth, amount: 0 }).p_effective_month).toBe(
      effectiveMonth,
    )
  })

  test.each([new Date(2021, 11, 31), new Date(2033, 0, 1), new Date(NaN)])(
    "範囲外または不正な月 %s の書き込みは拒否する",
    (targetMonth) => {
      expect(() => toMonthlyBudgetCreateArgs({ targetMonth, amount: 0 })).toThrow()
    },
  )
})
