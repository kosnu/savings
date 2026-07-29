import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { removePayment } from "./removePayment"

const mockMaybeSingle = vi.fn()
const mockSelect = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockBookEq = vi.fn(() => ({ select: mockSelect }))
const mockIdEq = vi.fn(() => ({ eq: mockBookEq }))
const mockDelete = vi.fn(() => ({ eq: mockIdEq }))
const mockFrom = vi.fn(() => ({ delete: mockDelete }))

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

describe("removePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("selected Bookの指定IDレコードだけを削除する", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 42 }, error: null })

    await removePayment(7, 42)

    expect(mockFrom).toHaveBeenCalledWith("payments")
    expect(mockDelete).toHaveBeenCalled()
    expect(mockIdEq).toHaveBeenCalledWith("id", 42)
    expect(mockBookEq).toHaveBeenCalledWith("book_id", 7)
    expect(mockSelect).toHaveBeenCalledWith("id")
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "削除に失敗しました", code: "42501" }
    mockMaybeSingle.mockResolvedValue({ data: null, error: supabaseError })

    await expect(removePayment(7, 1)).rejects.toEqual(supabaseError)
  })

  it("selected Book内に対象がない場合は成功扱いしない", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(removePayment(7, 1)).rejects.toThrow("Payment not found")
  })

  it("削除結果のIDが対象と一致しない場合は成功扱いしない", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 2 }, error: null })

    await expect(removePayment(7, 1)).rejects.toThrow("Payment not found")
  })
})
