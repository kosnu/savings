import { describe, expect, it, vi } from "vitest"
import { removePayment } from "./removePayment"

const mockEq = vi.fn()
const mockDelete = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ delete: mockDelete }))

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

describe("removePayment", () => {
  it("paymentsテーブルから指定IDのレコードを削除する", async () => {
    mockEq.mockResolvedValue({ error: null })

    await removePayment(42)

    expect(mockFrom).toHaveBeenCalledWith("payments")
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith("id", 42)
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "削除に失敗しました", code: "42501" }
    mockEq.mockResolvedValue({ error: supabaseError })

    await expect(removePayment(1)).rejects.toEqual(supabaseError)
  })
})
