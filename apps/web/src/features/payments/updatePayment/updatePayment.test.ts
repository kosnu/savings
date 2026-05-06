import { describe, expect, it, vi } from "vite-plus/test"

import { updatePayment } from "./updatePayment"

const mockEq = vi.fn()
const mockUpdate = vi.fn((_payload: Record<string, unknown>) => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ update: mockUpdate }))

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

describe("updatePayment", () => {
  it("paymentsテーブルの指定IDレコードを更新する", async () => {
    mockEq.mockResolvedValue({ error: null })

    await updatePayment(42, {
      amount: 1080,
      note: "dinner",
      categoryId: "11",
      date: new Date("2024-09-22"),
    })

    expect(mockFrom).toHaveBeenCalledWith("payments")
    expect(mockUpdate).toHaveBeenCalledWith({
      amount: 1080,
      note: "dinner",
      category_id: 11,
      date: "2024-09-22",
    })
    expect(mockUpdate.mock.calls[0]?.[0]).not.toHaveProperty("user_id")
    expect(mockEq).toHaveBeenCalledWith("id", 42)
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "更新に失敗しました", code: "42501" }
    mockEq.mockResolvedValue({ error: supabaseError })

    await expect(updatePayment(1, { note: "updated" })).rejects.toEqual(supabaseError)
  })
})
