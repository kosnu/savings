import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { removeCurrentMonthlyBudget, removeMonthlyBudget } from "./removeMonthlyBudget"

const mockRpc = vi.fn()

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}))

describe("removeMonthlyBudget", () => {
  beforeEach(() => {
    mockRpc.mockClear()
    vi.useRealTimers()
  })

  it("当月月予算削除RPCを呼び出す", async () => {
    mockRpc.mockResolvedValue({ error: null })

    await removeMonthlyBudget({
      targetMonth: new Date(2026, 2, 20),
      currentMonth: new Date(2026, 2, 20),
    })

    expect(mockRpc).toHaveBeenCalledWith("remove_current_monthly_budget", {
      p_target_month: "2026-03-01",
      p_current_month: "2026-03-01",
    })
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    const supabaseError = { message: "削除に失敗しました", code: "42501" }
    mockRpc.mockResolvedValue({ error: supabaseError })

    await expect(
      removeMonthlyBudget({
        targetMonth: new Date(2026, 2, 1),
        currentMonth: new Date(2026, 2, 1),
      }),
    ).rejects.toEqual(supabaseError)
  })

  it("現在月の削除では実行時点の月を対象月と基準月に使う", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 30, 23, 59))
    mockRpc.mockResolvedValue({ error: null })

    await removeCurrentMonthlyBudget()

    expect(mockRpc).toHaveBeenCalledWith("remove_current_monthly_budget", {
      p_target_month: "2026-04-01",
      p_current_month: "2026-04-01",
    })
  })
})
