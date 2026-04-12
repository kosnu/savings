import { describe, expect, it, vi } from "vitest"

import { createMonthlyBudgetHandlers } from "../../test/msw/handlers/monthlyBudgets"
import { server } from "../../test/msw/server"
import { renderHook, waitFor } from "../../test/test-utils"
import { supabaseTestClient } from "../../test/utils/createSupabaseTestClient"
import { useEffectiveMonthlyBudget } from "./useEffectiveMonthlyBudget"

vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("useEffectiveMonthlyBudget", () => {
  it("Date 指定時に対象月の有効な月予算を取得する", async () => {
    server.resetHandlers(...createMonthlyBudgetHandlers())

    const { result } = renderHook(() => useEffectiveMonthlyBudget(new Date(2025, 2, 1)))

    await waitFor(() => {
      expect(result.current.data?.id).toBe(2)
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("null 指定時は fetch せず data に null を返す", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: {
          error: true,
        },
      }),
    )

    const { result } = renderHook(() => useEffectiveMonthlyBudget(null))

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
