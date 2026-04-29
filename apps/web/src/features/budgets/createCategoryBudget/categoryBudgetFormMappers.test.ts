import { describe, expect, test } from "vite-plus/test"

import { toCategoryBudgetInsert } from "./categoryBudgetFormMappers"

describe("toCategoryBudgetInsert", () => {
  test("カテゴリ別予算作成用の値をcategory_budgets insert payloadに変換する", () => {
    expect(
      toCategoryBudgetInsert({
        categoryId: 10,
        targetMonth: new Date(2026, 2, 20),
        amount: 50000,
      }),
    ).toEqual({
      amount: 50000,
      category_id: 10,
      effective_from: "2026-03-01",
    })
  })

  test("選択日の年月を使い、日付は月初日に丸める", () => {
    expect(
      toCategoryBudgetInsert({
        categoryId: 20,
        targetMonth: new Date(2025, 6, 31),
        amount: 12000,
      }),
    ).toEqual({
      amount: 12000,
      category_id: 20,
      effective_from: "2025-07-01",
    })
  })
})
