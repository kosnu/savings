import { describe, expect, test } from "vite-plus/test"

import { toCategoryUpdateRpcArgs } from "./categoryUpdateMappers"

describe("toCategoryUpdateRpcArgs", () => {
  test("カテゴリ更新RPCの引数に変換する", () => {
    const args = toCategoryUpdateRpcArgs({
      categoryId: 10,
      name: "Groceries",
      categoryBudgetId: 30,
      budgetAmount: 50000,
    })

    expect(args).toEqual({
      p_category_id: 10,
      p_category_name: "Groceries",
      p_category_budget_id: 30,
      p_budget_amount: 50000,
    })
    expect(args).not.toHaveProperty("effective_from")
    expect(args).not.toHaveProperty("category_id")
  })
})
