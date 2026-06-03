import { describe, expect, it, vi } from "vite-plus/test"

import { createMonthlyBudget } from "./createMonthlyBudget"

const mockRpc = vi.fn()

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}))

describe("createMonthlyBudget", () => {
  it("月予算作成RPCに月初日とamountを渡す", async () => {
    mockRpc.mockResolvedValue({ error: null })

    await createMonthlyBudget({
      targetMonth: new Date(2026, 2, 20),
      amount: 300000,
    })

    expect(mockRpc).toHaveBeenCalledWith("create_monthly_budget", {
      p_amount: 300000,
      p_effective_month: "2026-03-01",
    })
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "重複しています", code: "23505" }
    mockRpc.mockResolvedValue({ error: supabaseError })

    await expect(
      createMonthlyBudget({
        targetMonth: new Date(2026, 2, 1),
        amount: 300000,
      }),
    ).rejects.toEqual(supabaseError)
  })
})
