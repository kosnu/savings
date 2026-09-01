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
  it("対象月を指定すると有効な月予算を取得する", async () => {
    server.resetHandlers(...createMonthlyBudgetHandlers())

    const { result } = renderHook(() => useEffectiveMonthlyBudget("2025-03"))

    await waitFor(() => {
      expect(result.current.data.monthlyBudget?.id).toBe(2)
    })
    expect(result.current.data.status).toBe("amount")
  })
})
