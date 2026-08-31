import { describe, expect, it, vi } from "vite-plus/test"

import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../test/msw/server"
import { renderHook, waitFor } from "../../../test/test-utils"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { useEffectiveMonthlyBudget } from "./useEffectiveMonthlyBudget"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("useEffectiveMonthlyBudget", () => {
  it("Date 指定時に対象月の有効な月予算を取得する", async () => {
    server.resetHandlers(...createMonthlyBudgetHandlers())

    const { result } = renderHook(() => useEffectiveMonthlyBudget(new Date(2025, 2, 1)))

    await waitFor(() => {
      expect(result.current.data.monthlyBudget?.id).toBe(2)
    })
    expect(result.current.data.status).toBe("amount")
  })
})
