import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { updateCategoryName } from "./updateCategoryName"

const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ single: mockSingle }))
const mockEq = vi.fn()
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ update: mockUpdate }))

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

describe("updateCategoryName", () => {
  beforeEach(() => {
    mockEq.mockReset()
    mockSelect.mockClear()
    mockSingle.mockReset()
    mockFrom.mockClear()
    mockUpdate.mockClear()
  })

  it("categoriesテーブルの指定IDレコードのnameを更新する", async () => {
    mockEq.mockReturnValue({ select: mockSelect })
    mockSingle.mockResolvedValue({ data: { id: 10 }, error: null })

    await updateCategoryName({
      categoryId: 10,
      name: "Groceries",
    })

    expect(mockFrom).toHaveBeenCalledWith("categories")
    expect(mockUpdate).toHaveBeenCalledWith({
      name: "Groceries",
    })
    expect(mockEq).toHaveBeenCalledWith("id", 10)
    expect(mockSelect).toHaveBeenCalledWith("id")
    expect(mockSingle).toHaveBeenCalledTimes(1)
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "更新に失敗しました", code: "42501" }
    mockEq.mockReturnValue({ select: mockSelect })
    mockSingle.mockResolvedValue({ data: null, error: supabaseError })

    await expect(
      updateCategoryName({
        categoryId: 10,
        name: "Groceries",
      }),
    ).rejects.toEqual(supabaseError)
  })

  it("更新対象が返らない場合にthrowする", async () => {
    mockEq.mockReturnValue({ select: mockSelect })
    mockSingle.mockResolvedValue({ data: null, error: null })

    await expect(
      updateCategoryName({
        categoryId: 999,
        name: "Groceries",
      }),
    ).rejects.toThrow("Category was not updated.")
  })
})
