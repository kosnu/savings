import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { updateCategoryName } from "./updateCategoryName"

const mockRpc = vi.fn()

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}))

describe("updateCategoryName", () => {
  beforeEach(() => {
    mockRpc.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 20))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("カテゴリID、名前、ピン状態で更新RPCを呼ぶ", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    await updateCategoryName({
      categoryId: 10,
      name: "Groceries",
      pinned: true,
      budgetAmount: 0,
      budgetAction: "set",
    })

    expect(mockRpc).toHaveBeenCalledWith("update_category_with_pin_and_budget", {
      p_budget_action: "set",
      p_budget_amount: 0,
      p_category_id: 10,
      p_category_name: "Groceries",
      p_effective_month: "2026-03-01",
      p_pinned: true,
    })
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "更新に失敗しました", code: "42501" }
    mockRpc.mockResolvedValue({ data: null, error: supabaseError })

    await expect(
      updateCategoryName({
        categoryId: 10,
        name: "Groceries",
        pinned: false,
        budgetAmount: null,
        budgetAction: "keep",
      }),
    ).rejects.toEqual(supabaseError)
  })
})
