import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { updateMonthlyBudget } from "./updateMonthlyBudget"

const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ single: mockSingle }))
const mockEq = vi.fn()
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ update: mockUpdate }))

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

describe("updateMonthlyBudget", () => {
  beforeEach(() => {
    mockEq.mockReset()
    mockSelect.mockClear()
    mockSingle.mockReset()
    mockFrom.mockClear()
    mockUpdate.mockClear()
  })

  it("monthly_budgetsテーブルの指定IDレコードのamountを更新する", async () => {
    mockEq.mockReturnValue({ select: mockSelect })
    mockSingle.mockResolvedValue({ data: { id: 42 }, error: null })

    await updateMonthlyBudget({
      monthlyBudgetId: 42,
      amount: 300000,
    })

    expect(mockFrom).toHaveBeenCalledWith("monthly_budgets")
    expect(mockUpdate).toHaveBeenCalledWith({
      amount: 300000,
    })
    expect(mockEq).toHaveBeenCalledWith("id", 42)
    expect(mockSelect).toHaveBeenCalledWith("id")
    expect(mockSingle).toHaveBeenCalledTimes(1)
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "更新に失敗しました", code: "42501" }
    mockEq.mockReturnValue({ select: mockSelect })
    mockSingle.mockResolvedValue({ data: null, error: supabaseError })

    await expect(
      updateMonthlyBudget({
        monthlyBudgetId: 1,
        amount: 300000,
      }),
    ).rejects.toEqual(supabaseError)
  })

  it("更新対象が返らない場合にthrowする", async () => {
    mockEq.mockReturnValue({ select: mockSelect })
    mockSingle.mockResolvedValue({ data: null, error: null })

    await expect(
      updateMonthlyBudget({
        monthlyBudgetId: 999,
        amount: 300000,
      }),
    ).rejects.toThrow("Monthly budget was not updated.")
  })
})
