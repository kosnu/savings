import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createCategory } from "./createCategory"

const mockRpc = vi.fn()

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    rpc: mockRpc,
  }),
}))

describe("createCategory", () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it("カテゴリ名とピン状態で作成し、作成したカテゴリIDを返す", async () => {
    mockRpc.mockResolvedValue({ data: 40, error: null })

    await expect(
      createCategory({ name: "Groceries", pinned: true, budgetAmount: 0 }),
    ).resolves.toBe(40)

    expect(mockRpc).toHaveBeenCalledWith("create_category_with_settings", {
      p_budget_amount: 0,
      p_category_name: "Groceries",
      p_pinned: true,
    })
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "重複しています", code: "23505" }
    mockRpc.mockResolvedValue({ data: null, error: supabaseError })

    await expect(
      createCategory({ name: "Groceries", pinned: false, budgetAmount: null }),
    ).rejects.toEqual(supabaseError)
  })

  it("カテゴリ名が20文字を超える場合はinsertを呼ばずにrejectする", async () => {
    await expect(
      createCategory({ name: "a".repeat(21), pinned: false, budgetAmount: null }),
    ).rejects.toThrow("Category name must be 20 characters or less")

    expect(mockRpc).not.toHaveBeenCalled()
  })
})
