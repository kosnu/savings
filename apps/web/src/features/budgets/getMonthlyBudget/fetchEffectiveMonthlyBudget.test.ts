import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { fetchEffectiveMonthlyBudget } from "./fetchEffectiveMonthlyBudget"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("fetchEffectiveMonthlyBudget", () => {
  beforeEach(() => {
    server.resetHandlers(...createMonthlyBudgetHandlers())
  })

  it("対象月と同じ年月の月予算を取得して domain model に変換する", async () => {
    const budget = await fetchEffectiveMonthlyBudget(new Date(2025, 2, 1))

    expect(budget).not.toBeNull()
    expect(budget?.id).toBe(2)
    expect(budget?.amount).toBe(62000)
    expect(budget?.effectiveFrom).toEqual(new Date(2025, 2, 30))
    expect(budget?.effectiveYear).toBe(2025)
    expect(budget?.effectiveMonth).toBe(3)
    expect(budget?.createdDate).toBeInstanceOf(Date)
    expect(budget?.updatedDate).toBeInstanceOf(Date)
  })

  it("予算未設定月は null を返す", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: {
          response: null,
        },
      }),
    )

    const budget = await fetchEffectiveMonthlyBudget(new Date(2024, 10, 1))

    expect(budget).toBeNull()
  })

  it("レスポンス shape が不正ならエラーにする", async () => {
    server.use(
      http.get("*/rest/v1/monthly_budgets*", () => {
        return HttpResponse.json({
          id: "invalid",
          amount: 62000,
          effective_from: "2025-03-30",
          effective_year: 2025,
          effective_month: 3,
          user_id: 100,
          created_at: "2025-03-30T00:00:00.000Z",
          updated_at: "2025-03-30T00:00:00.000Z",
        })
      }),
    )

    await expect(fetchEffectiveMonthlyBudget(new Date(2025, 2, 1))).rejects.toThrow(
      "Invalid monthly budget response",
    )
  })

  it("対象月末日・降順・1件取得で monthly_budgets を問い合わせる", async () => {
    const requestCapture: { url: URL | null } = { url: null }

    server.use(
      http.get("*/rest/v1/monthly_budgets*", ({ request }) => {
        requestCapture.url = new URL(request.url)

        return HttpResponse.json(monthlyBudgets[1])
      }),
    )

    await fetchEffectiveMonthlyBudget(new Date(2025, 2, 1))

    expect(requestCapture.url?.searchParams.get("effective_from")).toBe("lte.2025-03-31")
    expect(requestCapture.url?.searchParams.get("order")).toBe("effective_from.desc")
    expect(requestCapture.url?.searchParams.get("limit")).toBe("1")
  })
})
