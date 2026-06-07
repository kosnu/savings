import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { updateCategoryName } from "./updateCategoryName"

const mockRpc = vi.fn()

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}))

describe("updateCategoryName", () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it("カテゴリID、名前、ピン状態で更新RPCを呼ぶ", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    await updateCategoryName({
      categoryId: 10,
      budgetAmount: 3000,
      budgetStatus: "amount",
      name: "Groceries",
      pinned: true,
    })

    expect(mockRpc).toHaveBeenCalledWith("update_category_with_settings", {
      p_budget_amount: 3000,
      p_budget_status: "amount",
      p_category_id: 10,
      p_category_name: "Groceries",
      p_pinned: true,
    })
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "更新に失敗しました", code: "42501" }
    mockRpc.mockResolvedValue({ data: null, error: supabaseError })

    await expect(
      updateCategoryName({
        categoryId: 10,
        budgetAmount: null,
        budgetStatus: "unchanged",
        name: "Groceries",
        pinned: false,
      }),
    ).rejects.toEqual(supabaseError)
  })
})
