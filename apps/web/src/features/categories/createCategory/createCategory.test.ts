import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

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
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 20))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("カテゴリ名、ピン状態、予算額で作成し、作成したカテゴリIDを返す", async () => {
    mockRpc.mockResolvedValue({ data: 40, error: null })

    await expect(
      createCategory({ name: "Groceries", budgetAmount: "10000", pinned: true }),
    ).resolves.toBe(40)

    expect(mockRpc).toHaveBeenCalledWith("create_category_with_pin_and_budget", {
      p_budget_amount: 10000,
      p_category_name: "Groceries",
      p_effective_month: "2026-03-01",
      p_pinned: true,
    })
  })

  it("空の予算額はnullとして作成RPCに渡す", async () => {
    mockRpc.mockResolvedValue({ data: 40, error: null })

    await createCategory({ name: "Groceries", budgetAmount: "", pinned: false })

    expect(mockRpc).toHaveBeenCalledWith("create_category_with_pin_and_budget", {
      p_budget_amount: null,
      p_category_name: "Groceries",
      p_effective_month: "2026-03-01",
      p_pinned: false,
    })
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "重複しています", code: "23505" }
    mockRpc.mockResolvedValue({ data: null, error: supabaseError })

    await expect(
      createCategory({ name: "Groceries", budgetAmount: "", pinned: false }),
    ).rejects.toEqual(supabaseError)
  })

  it("カテゴリ名が20文字を超える場合はinsertを呼ばずにrejectする", async () => {
    await expect(
      createCategory({ name: "a".repeat(21), budgetAmount: "", pinned: false }),
    ).rejects.toThrow("Category name must be 20 characters or less")

    expect(mockRpc).not.toHaveBeenCalled()
  })
})
