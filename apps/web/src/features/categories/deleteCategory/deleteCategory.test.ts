import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { deleteCategory } from "./deleteCategory"

const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ single: mockSingle }))
const mockEq = vi.fn(() => ({ select: mockSelect }))
const mockDelete = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ delete: mockDelete }))

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

describe("deleteCategory", () => {
  beforeEach(() => {
    mockSingle.mockReset()
    mockSelect.mockClear()
    mockEq.mockClear()
    mockDelete.mockClear()
    mockFrom.mockClear()
  })

  it("categoriesテーブルから指定IDのレコードを削除する", async () => {
    mockSingle.mockResolvedValue({ data: { id: 10 }, error: null })

    await deleteCategory(10)

    expect(mockFrom).toHaveBeenCalledWith("categories")
    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockEq).toHaveBeenCalledWith("id", 10)
    expect(mockSelect).toHaveBeenCalledWith("id")
    expect(mockSingle).toHaveBeenCalledTimes(1)
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "削除に失敗しました", code: "42501" }
    mockSingle.mockResolvedValue({ data: null, error: supabaseError })

    await expect(deleteCategory(10)).rejects.toEqual(supabaseError)
  })

  it("削除対象が返らない場合にthrowする", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null })

    await expect(deleteCategory(999)).rejects.toThrow("Category was not deleted.")
  })
})
