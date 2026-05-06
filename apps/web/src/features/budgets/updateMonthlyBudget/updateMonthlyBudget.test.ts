import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { updateMonthlyBudget } from "./updateMonthlyBudget"

const mockEq = vi.fn()
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ update: mockUpdate }))

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

describe("updateMonthlyBudget", () => {
  beforeEach(() => {
    mockEq.mockReset()
    mockFrom.mockClear()
    mockUpdate.mockClear()
  })

  it("monthly_budgetsテーブルの指定IDレコードのamountを更新する", async () => {
    mockEq.mockResolvedValue({ error: null })

    await updateMonthlyBudget({
      monthlyBudgetId: 42,
      amount: 300000,
    })

    expect(mockFrom).toHaveBeenCalledWith("monthly_budgets")
    expect(mockUpdate).toHaveBeenCalledWith({
      amount: 300000,
    })
    expect(mockEq).toHaveBeenCalledWith("id", 42)
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "更新に失敗しました", code: "42501" }
    mockEq.mockResolvedValue({ error: supabaseError })

    await expect(
      updateMonthlyBudget({
        monthlyBudgetId: 1,
        amount: 300000,
      }),
    ).rejects.toEqual(supabaseError)
  })
})
