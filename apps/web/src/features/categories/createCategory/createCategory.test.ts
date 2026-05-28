import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createCategory } from "./createCategory"

const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  }),
}))

describe("createCategory", () => {
  beforeEach(() => {
    mockInsert.mockReset()
    mockSelect.mockReset()
    mockSingle.mockReset()
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
  })

  it("カテゴリ名だけで作成し、作成したカテゴリIDを返す", async () => {
    mockSingle.mockResolvedValue({ data: { id: 40 }, error: null })

    await expect(createCategory({ name: "Groceries" })).resolves.toBe(40)

    expect(mockInsert).toHaveBeenCalledWith({ name: "Groceries" })
    expect(mockSelect).toHaveBeenCalledWith("id")
    expect(mockSingle).toHaveBeenCalledTimes(1)
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "重複しています", code: "23505" }
    mockSingle.mockResolvedValue({ data: null, error: supabaseError })

    await expect(createCategory({ name: "Groceries" })).rejects.toEqual(supabaseError)
  })

  it("カテゴリ名が20文字を超える場合はinsertを呼ばずにrejectする", async () => {
    await expect(createCategory({ name: "a".repeat(21) })).rejects.toThrow(
      "Category name must be 20 characters or less",
    )

    expect(mockInsert).not.toHaveBeenCalled()
  })
})
