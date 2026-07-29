import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { updatePayment } from "./updatePayment"

const mockMaybeSingle = vi.fn()
const mockSelect = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockBookEq = vi.fn(() => ({ select: mockSelect }))
const mockIdEq = vi.fn(() => ({ eq: mockBookEq }))
const mockUpdate = vi.fn((_payload: Record<string, unknown>) => ({ eq: mockIdEq }))
const mockFrom = vi.fn(() => ({ update: mockUpdate }))

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

describe("updatePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("selected Bookの指定IDレコードだけを更新する", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 42 }, error: null })

    await updatePayment(7, 42, {
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
    expect(mockUpdate.mock.calls[0]?.[0]).not.toHaveProperty("book_id")
    expect(mockIdEq).toHaveBeenCalledWith("id", 42)
    expect(mockBookEq).toHaveBeenCalledWith("book_id", 7)
    expect(mockSelect).toHaveBeenCalledWith("id")
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "更新に失敗しました", code: "42501" }
    mockMaybeSingle.mockResolvedValue({ data: null, error: supabaseError })

    await expect(updatePayment(7, 1, { note: "updated" })).rejects.toEqual(supabaseError)
  })

  it("selected Book内に対象がない場合は成功扱いしない", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(updatePayment(7, 1, { note: "updated" })).rejects.toThrow("Payment not found")
  })

  it("更新結果のIDが対象と一致しない場合は成功扱いしない", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 2 }, error: null })

    await expect(updatePayment(7, 1, { note: "updated" })).rejects.toThrow("Payment not found")
  })
})
