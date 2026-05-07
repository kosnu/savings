import { describe, expect, test } from "vite-plus/test"

import { toMonthlyBudgetInsert } from "./monthlyBudgetFormMappers"

describe("toMonthlyBudgetInsert", () => {
  test("月予算作成用の値をmonthly_budgets insert payloadに変換する", () => {
    expect(
      toMonthlyBudgetInsert({
        targetMonth: new Date(2026, 2, 20),
        amount: 300000,
      }),
    ).toEqual({
      amount: 300000,
      effective_from: "2026-03-01",
    })
    expect(
      toMonthlyBudgetInsert({
        targetMonth: new Date(2026, 2, 20),
        amount: 300000,
      }),
    ).not.toHaveProperty("book_id")
    expect(
      toMonthlyBudgetInsert({
        targetMonth: new Date(2026, 2, 20),
        amount: 300000,
      }),
    ).not.toHaveProperty("user_id")
  })

  test("選択日の年月を使い、日付は月初日に丸める", () => {
    expect(
      toMonthlyBudgetInsert({
        targetMonth: new Date(2025, 6, 31),
        amount: 75000,
      }),
    ).toEqual({
      amount: 75000,
      effective_from: "2025-07-01",
    })
  })
})
