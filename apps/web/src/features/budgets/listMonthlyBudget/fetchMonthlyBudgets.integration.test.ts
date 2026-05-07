import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { fetchMonthlyBudgets } from "./fetchMonthlyBudgets"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("fetchMonthlyBudgets", () => {
  beforeEach(() => {
    server.resetHandlers(...createMonthlyBudgetHandlers())
  })

  it("月予算一覧を取得して domain model に変換する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: {
          response: [monthlyBudgets[3], monthlyBudgets[2]],
        },
      }),
    )

    const budgets = await fetchMonthlyBudgets(2)

    expect(budgets).toHaveLength(2)
    expect(budgets[0]).toMatchObject({
      id: 3,
      amount: 75000,
      bookId: 1,
      effectiveYear: 2025,
      effectiveMonth: 7,
      userId: 100,
    })
    expect(budgets[0]?.effectiveFrom).toEqual(new Date(2025, 6, 1))
    expect(budgets[0]?.createdDate).toBeInstanceOf(Date)
    expect(budgets[0]?.updatedDate).toBeInstanceOf(Date)
  })

  it("登録済み月予算がない場合は空配列を返す", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: {
          response: [],
        },
      }),
    )

    await expect(fetchMonthlyBudgets(10)).resolves.toEqual([])
  })

  it("直近順・指定件数で monthly_budgets を問い合わせる", async () => {
    const requestCapture: { url: URL | null } = { url: null }

    server.use(
      http.get("*/rest/v1/monthly_budgets*", ({ request }) => {
        requestCapture.url = new URL(request.url)

        return HttpResponse.json([monthlyBudgets[3], monthlyBudgets[2]])
      }),
    )

    await fetchMonthlyBudgets(2)

    const select = requestCapture.url?.searchParams.get("select")
    expect(select).toContain("id")
    expect(select).toContain("book_id")
    expect(select).toContain("amount")
    expect(select).toContain("effective_from")
    expect(select).toContain("effective_year")
    expect(select).toContain("effective_month")
    expect(select).toContain("user_id")
    expect(select).toContain("created_at")
    expect(select).toContain("updated_at")
    expect(requestCapture.url?.searchParams.get("order")).toBe("effective_from.desc")
    expect(requestCapture.url?.searchParams.get("limit")).toBe("2")
  })

  it("レスポンス shape が不正ならエラーにする", async () => {
    server.use(
      http.get("*/rest/v1/monthly_budgets*", () => {
        return HttpResponse.json([
          {
            id: "invalid",
            book_id: 1,
            amount: 62000,
            effective_from: "2025-03-30",
            effective_year: 2025,
            effective_month: 3,
            user_id: 100,
            created_at: "2025-03-30T00:00:00.000Z",
            updated_at: "2025-03-30T00:00:00.000Z",
          },
        ])
      }),
    )

    await expect(fetchMonthlyBudgets(10)).rejects.toThrow("Invalid monthly budget response")
  })

  it("取得件数が正の整数でない場合は問い合わせ前にエラーにする", async () => {
    const requestSpy = vi.fn()

    server.use(
      http.get("*/rest/v1/monthly_budgets*", () => {
        requestSpy()

        return HttpResponse.json([])
      }),
    )

    for (const limit of [0, -1, 1.5, Number.NaN]) {
      await expect(fetchMonthlyBudgets(limit)).rejects.toThrow(RangeError)
    }
    expect(requestSpy).not.toHaveBeenCalled()
  })
})
