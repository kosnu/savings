import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { updateCategoryPin } from "./updateCategoryPin"

const mockInsertSingle = vi.fn()
const mockInsertSelect = vi.fn(() => ({ single: mockInsertSingle }))
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }))
const mockDeleteSelect = vi.fn()
const mockDeleteEq = vi.fn(() => ({ select: mockDeleteSelect }))
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }))
const mockFrom = vi.fn(() => ({ insert: mockInsert, delete: mockDelete }))

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

describe("updateCategoryPin", () => {
  beforeEach(() => {
    mockInsertSingle.mockReset()
    mockInsertSelect.mockClear()
    mockInsert.mockClear()
    mockDeleteSelect.mockReset()
    mockDeleteEq.mockClear()
    mockDelete.mockClear()
    mockFrom.mockClear()
  })

  it("pinned true の場合は category_pins に作成する", async () => {
    mockInsertSingle.mockResolvedValue({ data: { id: 100 }, error: null })

    await updateCategoryPin({ categoryId: 10, pinned: true })

    expect(mockFrom).toHaveBeenCalledWith("category_pins")
    expect(mockInsert).toHaveBeenCalledWith({ category_id: 10 })
    expect(mockInsertSelect).toHaveBeenCalledWith("id")
    expect(mockInsertSingle).toHaveBeenCalledTimes(1)
  })

  it("pinned false の場合は category_pins から削除する", async () => {
    mockDeleteSelect.mockResolvedValue({ data: [{ id: 100 }], error: null })

    await updateCategoryPin({ categoryId: 10, pinned: false })

    expect(mockFrom).toHaveBeenCalledWith("category_pins")
    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockDeleteEq).toHaveBeenCalledWith("category_id", 10)
    expect(mockDeleteSelect).toHaveBeenCalledWith("id")
  })

  it("unpin対象がなくてもresolveする", async () => {
    mockDeleteSelect.mockResolvedValue({ data: [], error: null })

    await expect(updateCategoryPin({ categoryId: 10, pinned: false })).resolves.toBeUndefined()
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "更新に失敗しました", code: "42501" }
    mockInsertSingle.mockResolvedValue({ data: null, error: supabaseError })

    await expect(updateCategoryPin({ categoryId: 10, pinned: true })).rejects.toEqual(supabaseError)
  })

  it("作成対象が返らない場合にthrowする", async () => {
    mockInsertSingle.mockResolvedValue({ data: null, error: null })

    await expect(updateCategoryPin({ categoryId: 10, pinned: true })).rejects.toThrow(
      "Category pin was not created.",
    )
  })
})
