import { describe, expect, it, vi } from "vite-plus/test"

import { createCategoryBudget } from "./createCategoryBudget"

const mockInsert = vi.fn()
const mockFrom = vi.fn(() => ({ insert: mockInsert }))

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

describe("createCategoryBudget", () => {
  it("category_budgetsにカテゴリID、月初日のeffective_from、amountをinsertする", async () => {
    mockInsert.mockResolvedValue({ error: null })

    await createCategoryBudget({
      categoryId: 10,
      targetMonth: new Date(2026, 2, 20),
      amount: 50000,
    })

    expect(mockFrom).toHaveBeenCalledWith("category_budgets")
    expect(mockInsert).toHaveBeenCalledWith({
      amount: 50000,
      category_id: 10,
      effective_from: "2026-03-01",
    })
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "重複しています", code: "23505" }
    mockInsert.mockResolvedValue({ error: supabaseError })

    await expect(
      createCategoryBudget({
        categoryId: 10,
        targetMonth: new Date(2026, 2, 1),
        amount: 50000,
      }),
    ).rejects.toEqual(supabaseError)
  })
})
