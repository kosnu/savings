import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createCategory } from "./createCategory"

const mockRpc = vi.fn()

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}))

describe("createCategory", () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("カテゴリ名だけでRPCを呼び、作成したカテゴリIDを返す", async () => {
    mockRpc.mockResolvedValue({ data: 40, error: null })

    await expect(createCategory({ name: "Groceries" })).resolves.toBe(40)

    expect(mockRpc).toHaveBeenCalledWith("create_category_with_budget", {
      p_category_name: "Groceries",
    })
  })

  it("月予算つきでRPCを呼ぶ", async () => {
    const march20 = new Date(2026, 2, 20, 12, 34, 56)

    mockRpc.mockResolvedValue({ data: 40, error: null })
    vi.useFakeTimers()
    vi.setSystemTime(march20)

    await createCategory({
      name: "Groceries",
      budgetAmount: 50000,
    })

    expect(mockRpc).toHaveBeenCalledWith("create_category_with_budget", {
      p_category_name: "Groceries",
      p_budget_effective_from: "2026-03-01",
      p_budget_amount: 50000,
    })
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "重複しています", code: "23505" }
    mockRpc.mockResolvedValue({ data: null, error: supabaseError })

    await expect(createCategory({ name: "Groceries" })).rejects.toEqual(supabaseError)
  })

  it("カテゴリ名が20文字を超える場合はRPCを呼ばずにrejectする", async () => {
    await expect(createCategory({ name: "a".repeat(21) })).rejects.toThrow(
      "Category name must be 20 characters or less",
    )

    expect(mockRpc).not.toHaveBeenCalled()
  })
})
