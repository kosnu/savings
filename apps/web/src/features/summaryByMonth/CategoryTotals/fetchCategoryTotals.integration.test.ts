import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { payments } from "../../../test/data/payments"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import { fetchCategoryTotals } from "./fetchCategoryTotals"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("fetchCategoryTotals", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategoryHandlers())
  })

  it("カテゴリごとの月合計額を1 queryで取得する", async () => {
    const totals = await fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")])

    expect(totals).toEqual({
      Food: 1000,
      "Daily Necessities": 4000,
      Entertainment: 0,
    })
  })

  it("支払いがないカテゴリを0円として返す", async () => {
    server.resetHandlers(
      ...createCategoryHandlers({
        get: {
          paymentRows: [
            {
              ...mapPaymentToRow(payments[0]),
              category_id: 10,
            },
          ],
        },
      }),
    )

    const totals = await fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")])

    expect(totals["Food"]).toBe(1000)
    expect(totals["Daily Necessities"]).toBe(0)
    expect(totals["Entertainment"]).toBe(0)
  })

  it("カテゴリと月内支払いを取得するqueryを送る", async () => {
    const requestCapture: { url: URL | null } = { url: null }
    server.use(
      http.get("*/rest/v1/categories*", ({ request }) => {
        requestCapture.url = new URL(request.url)

        return HttpResponse.json([])
      }),
    )

    await fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")])

    const select = requestCapture.url?.searchParams.get("select")
    expect(select).toContain("id")
    expect(select).toContain("name")
    expect(select).toContain("payments:payments!payments_category_id_fkey")
    expect(requestCapture.url?.searchParams.getAll("payments.date")).toEqual([
      "gte.2025-06-01",
      "lte.2025-06-30",
    ])
    expect(requestCapture.url?.searchParams.get("order")).toBe("id.asc")
  })

  it("レスポンスshapeが不正ならエラーにする", async () => {
    server.use(
      http.get("*/rest/v1/categories*", () => {
        return HttpResponse.json([
          {
            id: "invalid",
            name: "Food",
            payments: [],
          },
        ])
      }),
    )

    await expect(
      fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")]),
    ).rejects.toThrow("Invalid category totals response")
  })
})
