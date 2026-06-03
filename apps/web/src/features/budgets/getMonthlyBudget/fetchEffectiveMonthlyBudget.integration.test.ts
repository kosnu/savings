import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

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
    const budgetState = await fetchEffectiveMonthlyBudget(new Date(2025, 2, 1))

    expect(budgetState.status).toBe("amount")
    const budget = budgetState.monthlyBudget
    expect(budget?.id).toBe(2)
    expect(budget?.bookId).toBe(1)
    expect(budget?.amount).toBe(62000)
    expect(budget?.effectiveFrom).toEqual(new Date(2025, 2, 30))
    expect(budget?.effectiveYear).toBe(2025)
    expect(budget?.effectiveMonth).toBe(3)
    expect(budget?.createdDate).toBeInstanceOf(Date)
    expect(budget?.updatedDate).toBeInstanceOf(Date)
  })

  it("予算未設定月は unset を返す", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: {
          response: null,
        },
      }),
    )

    const budgetState = await fetchEffectiveMonthlyBudget(new Date(2024, 10, 1))

    expect(budgetState).toEqual({ status: "unset", monthlyBudget: null })
  })

  it("予算なし月は none を返す", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: {
          response: { status: "none", monthly_budget: null },
        },
      }),
    )

    const budgetState = await fetchEffectiveMonthlyBudget(new Date(2026, 9, 1))

    expect(budgetState).toEqual({ status: "none", monthlyBudget: null })
  })

  it("削除後の当月は過去予算を復活させず、過去月は当時の予算を返す", async () => {
    server.use(
      http.post("*/rest/v1/rpc/get_effective_monthly_budget", async ({ request }) => {
        const body = (await request.json()) as { p_target_month: string }

        if (body.p_target_month === "2026-09-01") {
          return HttpResponse.json({
            status: "amount",
            monthly_budget: {
              ...monthlyBudgets[3],
              amount: 90000,
              effective_from: "2026-09-01",
              effective_year: 2026,
              effective_month: 9,
            },
          })
        }

        return HttpResponse.json({ status: "none", monthly_budget: null })
      }),
    )

    await expect(fetchEffectiveMonthlyBudget(new Date(2026, 9, 1))).resolves.toEqual({
      status: "none",
      monthlyBudget: null,
    })
    await expect(fetchEffectiveMonthlyBudget(new Date(2026, 8, 1))).resolves.toEqual({
      status: "amount",
      monthlyBudget: expect.objectContaining({
        amount: 90000,
        effectiveFrom: new Date(2026, 8, 1),
      }),
    })
  })

  it("レスポンス shape が不正ならエラーにする", async () => {
    server.use(
      http.post("*/rest/v1/rpc/get_effective_monthly_budget", () => {
        return HttpResponse.json({
          id: "invalid",
          book_id: 1,
          amount: 62000,
          effective_from: "2025-03-30",
          effective_year: 2025,
          effective_month: 3,
          created_at: "2025-03-30T00:00:00.000Z",
          updated_at: "2025-03-30T00:00:00.000Z",
        })
      }),
    )

    await expect(fetchEffectiveMonthlyBudget(new Date(2025, 2, 1))).rejects.toThrow(
      "Invalid monthly budget response",
    )
  })

  it("対象月を指定して有効月予算RPCを呼び出す", async () => {
    const requestCapture: { url: URL | null; body: unknown } = { url: null, body: null }

    server.use(
      http.post("*/rest/v1/rpc/get_effective_monthly_budget", async ({ request }) => {
        requestCapture.url = new URL(request.url)
        requestCapture.body = await request.json()

        return HttpResponse.json({ status: "amount", monthly_budget: monthlyBudgets[1] })
      }),
    )

    await fetchEffectiveMonthlyBudget(new Date(2025, 2, 1))

    expect(requestCapture.url?.pathname).toContain("/rpc/get_effective_monthly_budget")
    expect(requestCapture.body).toEqual({ p_target_month: "2025-03-01" })
  })
})
