import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { removeMonthlyBudget } from "./removeMonthlyBudget"

const mockRpc = vi.fn()

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}))

describe("removeMonthlyBudget", () => {
  beforeEach(() => {
    mockRpc.mockClear()
  })

  it("当月月予算削除RPCを呼び出す", async () => {
    mockRpc.mockResolvedValue({ error: null })

    await removeMonthlyBudget()

    expect(mockRpc).toHaveBeenCalledWith("remove_current_monthly_budget")
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "削除に失敗しました", code: "42501" }
    mockRpc.mockResolvedValue({ error: supabaseError })

    await expect(removeMonthlyBudget()).rejects.toEqual(supabaseError)
  })
})
