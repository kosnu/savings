import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { updateMonthlyBudget } from "./updateMonthlyBudget"

const mockRpc = vi.fn()

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}))

describe("updateMonthlyBudget", () => {
  beforeEach(() => {
    mockRpc.mockClear()
  })

  it("当月月予算更新RPCにamountを渡す", async () => {
    mockRpc.mockResolvedValue({ error: null })

    await updateMonthlyBudget({
      targetMonth: new Date(2026, 2, 20),
      amount: 300000,
    })

    expect(mockRpc).toHaveBeenCalledWith("update_current_monthly_budget", {
      p_target_month: "2026-03-01",
      p_amount: 300000,
    })
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "更新に失敗しました", code: "42501" }
    mockRpc.mockResolvedValue({ error: supabaseError })

    await expect(
      updateMonthlyBudget({
        targetMonth: new Date(2026, 2, 1),
        amount: 300000,
      }),
    ).rejects.toEqual(supabaseError)
  })
})
