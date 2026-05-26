import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { updateCategory } from "./updateCategory"

const mockRpc = vi.fn()
const mockFrom = vi.fn(() => {
  throw new Error("Direct table update must not be used.")
})

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc: mockRpc, from: mockFrom }),
}))

describe("updateCategory", () => {
  beforeEach(() => {
    mockRpc.mockReset()
    mockFrom.mockClear()
  })

  it("カテゴリ更新RPCを呼ぶ", async () => {
    mockRpc.mockResolvedValue({ data: undefined, error: null })

    await expect(
      updateCategory({
        categoryId: 10,
        name: "Groceries",
        categoryBudgetId: 30,
        budgetAmount: 50000,
      }),
    ).resolves.toBeUndefined()

    expect(mockRpc).toHaveBeenCalledWith("update_category_with_budget", {
      p_category_id: 10,
      p_category_name: "Groceries",
      p_category_budget_id: 30,
      p_budget_amount: 50000,
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("RPCの戻り値dataに依存せず成功扱いにする", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    await expect(
      updateCategory({
        categoryId: 10,
        name: "Groceries",
        categoryBudgetId: 30,
        budgetAmount: 50000,
      }),
    ).resolves.toBeUndefined()
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "更新に失敗しました", code: "42501" }
    mockRpc.mockResolvedValue({ data: null, error: supabaseError })

    await expect(
      updateCategory({
        categoryId: 10,
        name: "Groceries",
        categoryBudgetId: 30,
        budgetAmount: 50000,
      }),
    ).rejects.toEqual(supabaseError)
  })
})
