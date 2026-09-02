import { beforeEach, expect, it, vi } from "vite-plus/test"

import { updateMonthlyBudget } from "./updateMonthlyBudget"

const mockRpc = vi.fn()

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}))

beforeEach(() => {
  mockRpc.mockClear()
})

it("対象月予算IDとamountを更新RPCに渡す", async () => {
  mockRpc.mockResolvedValue({ error: null })

  await updateMonthlyBudget({
    monthlyBudgetId: 42,
    amount: 300000,
  })

  expect(mockRpc).toHaveBeenCalledWith("update_current_monthly_budget", {
    p_monthly_budget_id: 42,
    p_amount: 300000,
  })
})

it("Supabaseがエラーを返した場合にthrowする", async () => {
  const supabaseError = { message: "更新に失敗しました", code: "42501" }
  mockRpc.mockResolvedValue({ error: supabaseError })

  await expect(
    updateMonthlyBudget({
      monthlyBudgetId: 42,
      amount: 300000,
    }),
  ).rejects.toEqual(supabaseError)
})
