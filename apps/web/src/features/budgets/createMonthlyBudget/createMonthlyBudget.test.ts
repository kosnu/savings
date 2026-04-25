import { describe, expect, it, vi } from "vite-plus/test"

import { createMonthlyBudget } from "./createMonthlyBudget"

const mockInsert = vi.fn()
const mockFrom = vi.fn(() => ({ insert: mockInsert }))

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

describe("createMonthlyBudget", () => {
  it("monthly_budgetsに月初日のeffective_fromとamountをinsertする", async () => {
    mockInsert.mockResolvedValue({ error: null })

    await createMonthlyBudget({
      targetMonth: new Date(2026, 2, 20),
      amount: 300000,
    })

    expect(mockFrom).toHaveBeenCalledWith("monthly_budgets")
    expect(mockInsert).toHaveBeenCalledWith({
      amount: 300000,
      effective_from: "2026-03-01",
    })
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "重複しています", code: "23505" }
    mockInsert.mockResolvedValue({ error: supabaseError })

    await expect(
      createMonthlyBudget({
        targetMonth: new Date(2026, 2, 1),
        amount: 300000,
      }),
    ).rejects.toEqual(supabaseError)
  })
})
