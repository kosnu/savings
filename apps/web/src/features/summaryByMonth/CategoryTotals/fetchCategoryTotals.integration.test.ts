import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { payments } from "../../../test/data/payments"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import { fetchCategoryTotals } from "./fetchCategoryTotals"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("fetchCategoryTotals", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategoryHandlers(), ...createPaymentHandlers())
  })

  it("カテゴリごとの月合計額を取得する", async () => {
    const totals = await fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")])

    expect(totals).toEqual([
      {
        key: "category:10",
        categoryId: 10,
        categoryName: "Food",
        totalAmount: 1000,
        pinned: true,
        kind: "category",
      },
      {
        key: "category:20",
        categoryId: 20,
        categoryName: "Daily Necessities",
        totalAmount: 4000,
        pinned: false,
        kind: "category",
      },
      {
        key: "category:30",
        categoryId: 30,
        categoryName: "Entertainment",
        totalAmount: 0,
        pinned: false,
        kind: "category",
      },
      {
        key: "uncategorized",
        categoryId: null,
        categoryName: "Unknown",
        totalAmount: 0,
        pinned: false,
        kind: "uncategorized",
      },
    ])
  })

  it("支払いがないカテゴリを0円として返す", async () => {
    const paymentRows = [
      {
        ...mapPaymentToRow(payments[0]),
        category_id: 10,
      },
    ]

    server.resetHandlers(
      ...createCategoryHandlers({
        get: {
          paymentRows,
        },
      }),
      ...createPaymentHandlers({
        initialRows: paymentRows,
      }),
    )

    const totals = await fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")])

    expect(totals.find((total) => total.key === "category:10")).toMatchObject({
      categoryName: "Food",
      totalAmount: 1000,
    })
    expect(totals.find((total) => total.key === "category:20")).toMatchObject({
      categoryName: "Daily Necessities",
      totalAmount: 0,
    })
    expect(totals.find((total) => total.key === "category:30")).toMatchObject({
      categoryName: "Entertainment",
      totalAmount: 0,
    })
    expect(totals.find((total) => total.key === "uncategorized")).toMatchObject({
      categoryName: "Unknown",
      totalAmount: 0,
    })
  })

  it("未分類支払いをUnknownに集計する", async () => {
    const paymentRows = [
      {
        ...mapPaymentToRow(payments[0]),
        category_id: 10,
      },
      {
        ...mapPaymentToRow(payments[1]),
        id: 999,
        category_id: null,
        amount: 2500,
      },
    ]

    server.resetHandlers(
      ...createCategoryHandlers({
        get: {
          paymentRows,
        },
      }),
      ...createPaymentHandlers({
        initialRows: paymentRows,
      }),
    )

    const totals = await fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")])

    expect(totals.find((total) => total.key === "category:10")).toMatchObject({
      categoryName: "Food",
      totalAmount: 1000,
    })
    expect(totals.find((total) => total.key === "uncategorized")).toMatchObject({
      categoryName: "Unknown",
      totalAmount: 2500,
    })
  })

  it("Unknownという名前のカテゴリと未分類支払いを別keyで返す", async () => {
    const categoryRows = [
      {
        id: 10,
        book_id: 1,
        name: "Food",
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
      },
      {
        id: 40,
        book_id: 1,
        name: "Unknown",
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
      },
    ]
    const paymentRows = [
      {
        ...mapPaymentToRow(payments[0]),
        category_id: 40,
        amount: 700,
      },
      {
        ...mapPaymentToRow(payments[1]),
        id: 999,
        category_id: null,
        amount: 2500,
      },
    ]

    server.resetHandlers(
      ...createCategoryHandlers({
        get: {
          response: categoryRows,
          paymentRows,
        },
      }),
      ...createPaymentHandlers({
        initialRows: paymentRows,
      }),
    )

    const totals = await fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")])

    expect(totals.find((total) => total.key === "category:40")).toMatchObject({
      categoryName: "Unknown",
      totalAmount: 700,
    })
    expect(totals.find((total) => total.key === "uncategorized")).toMatchObject({
      categoryName: "Unknown",
      totalAmount: 2500,
    })
  })

  it("ピン留めカテゴリを優先し、同一グループ内はID昇順で返す", async () => {
    server.resetHandlers(
      ...createCategoryHandlers({
        get: {
          pinnedCategoryIds: [30, 10],
        },
      }),
      ...createPaymentHandlers(),
    )

    const totals = await fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")])

    expect(totals.map((total) => total.key)).toEqual([
      "category:10",
      "category:30",
      "category:20",
      "uncategorized",
    ])
    expect(totals.map((total) => total.pinned)).toEqual([true, true, false, false])
  })

  it("カテゴリと月内未分類支払いを取得するqueryを送る", async () => {
    const requestCapture: { categoriesUrl: URL | null; paymentsUrl: URL | null } = {
      categoriesUrl: null,
      paymentsUrl: null,
    }
    server.use(
      http.get("*/rest/v1/categories*", ({ request }) => {
        requestCapture.categoriesUrl = new URL(request.url)

        return HttpResponse.json([])
      }),
      http.get("*/rest/v1/payments*", ({ request }) => {
        requestCapture.paymentsUrl = new URL(request.url)

        return HttpResponse.json([])
      }),
    )

    await fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")])

    const categorySelect = requestCapture.categoriesUrl?.searchParams.get("select")
    expect(categorySelect).toContain("id")
    expect(categorySelect).toContain("name")
    expect(categorySelect).toContain("category_pins:category_pins!category_pins_category_id_fkey")
    expect(categorySelect).toContain("payments:payments!payments_category_id_fkey")
    expect(requestCapture.categoriesUrl?.searchParams.getAll("payments.date")).toEqual([
      "gte.2025-06-01",
      "lte.2025-06-30",
    ])
    expect(requestCapture.categoriesUrl?.searchParams.get("order")).toBe("id.asc")

    expect(requestCapture.paymentsUrl?.searchParams.get("select")).toBe("amount,date")
    expect(requestCapture.paymentsUrl?.searchParams.get("category_id")).toBe("is.null")
    expect(requestCapture.paymentsUrl?.searchParams.getAll("date")).toEqual([
      "gte.2025-06-01",
      "lte.2025-06-30",
    ])
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

  it("未分類支払いのレスポンスshapeが不正ならエラーにする", async () => {
    server.use(
      http.get("*/rest/v1/payments*", () => {
        return HttpResponse.json([
          {
            amount: "invalid",
            date: "2025-06-01",
          },
        ])
      }),
    )

    await expect(
      fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")]),
    ).rejects.toThrow("Invalid category totals response")
  })
})
