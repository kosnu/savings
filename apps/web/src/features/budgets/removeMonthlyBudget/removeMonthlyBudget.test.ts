import { beforeEach, expect, it, vi } from "vite-plus/test"

import { removeMonthlyBudget } from "./removeMonthlyBudget"

const mockRpc = vi.fn()

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}))

beforeEach(() => {
  mockRpc.mockClear()
})

it("対象月予算IDを削除RPCに渡す", async () => {
  mockRpc.mockResolvedValue({ error: null })

  await removeMonthlyBudget(42)

  expect(mockRpc).toHaveBeenCalledWith("remove_current_monthly_budget", {
    p_monthly_budget_id: 42,
  })
})

it("Supabaseがエラーを返した場合にthrowする", async () => {
  const supabaseError = { message: "削除に失敗しました", code: "42501" }
  mockRpc.mockResolvedValue({ error: supabaseError })

  await expect(removeMonthlyBudget(42)).rejects.toEqual(supabaseError)
})
