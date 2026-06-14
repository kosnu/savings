import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { deleteCategory } from "./deleteCategory"

const mockRpc = vi.fn()

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}))

describe("deleteCategory", () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it("カテゴリ削除RPCを呼ぶ", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    await deleteCategory(10)

    expect(mockRpc).toHaveBeenCalledWith("delete_category_with_budget", {
      p_category_id: 10,
    })
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "削除に失敗しました", code: "42501" }
    mockRpc.mockResolvedValue({ data: null, error: supabaseError })

    await expect(deleteCategory(10)).rejects.toEqual(supabaseError)
  })
})
