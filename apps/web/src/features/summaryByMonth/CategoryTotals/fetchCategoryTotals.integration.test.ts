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
        budgetStatus: "amount",
        budgetAmount: 30000,
        budgetDifference: 29000,
        pinned: true,
        kind: "category",
      },
      {
        key: "category:20",
        categoryId: 20,
        categoryName: "Daily Necessities",
        totalAmount: 4000,
        budgetStatus: "amount",
        budgetAmount: 4000,
        budgetDifference: 0,
        pinned: false,
        kind: "category",
      },
      {
        key: "category:30",
        categoryId: 30,
        categoryName: "Entertainment",
        totalAmount: 0,
        budgetStatus: "unset",
        budgetAmount: null,
        budgetDifference: null,
        pinned: false,
        kind: "category",
      },
      {
        key: "uncategorized",
        categoryId: null,
        categoryName: "Unknown",
        totalAmount: 0,
        budgetStatus: "unset",
        budgetAmount: null,
        budgetDifference: null,
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
      budgetDifference: 29000,
    })
    expect(totals.find((total) => total.key === "category:20")).toMatchObject({
      categoryName: "Daily Necessities",
      totalAmount: 0,
      budgetDifference: 4000,
    })
    expect(totals.find((total) => total.key === "category:30")).toMatchObject({
      categoryName: "Entertainment",
      totalAmount: 0,
      budgetDifference: null,
    })
    expect(totals.find((total) => total.key === "uncategorized")).toMatchObject({
      categoryName: "Unknown",
      totalAmount: 0,
      budgetDifference: null,
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
      budgetDifference: 29000,
    })
    expect(totals.find((total) => total.key === "uncategorized")).toMatchObject({
      categoryName: "Unknown",
      totalAmount: 2500,
      budgetDifference: null,
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
      budgetDifference: null,
    })
    expect(totals.find((total) => total.key === "uncategorized")).toMatchObject({
      categoryName: "Unknown",
      totalAmount: 2500,
      budgetDifference: null,
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

  it("カテゴリ、月内未分類支払い、有効予算を取得するqueryを送る", async () => {
    const requestCapture: {
      categoriesUrl: URL | null
      paymentsUrl: URL | null
      budgetBody: unknown
    } = {
      categoriesUrl: null,
      paymentsUrl: null,
      budgetBody: null,
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
      http.post("*/rest/v1/rpc/get_effective_category_budgets", async ({ request }) => {
        requestCapture.budgetBody = await request.json()

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
    expect(requestCapture.budgetBody).toEqual({ p_target_month: "2025-06-01" })
  })

  it("予算なし状態と0円予算を区別して差分を返す", async () => {
    server.resetHandlers(
      ...createCategoryHandlers({
        get: {
          budgetRows: [
            { category_id: 10, status: "amount", amount: 0 },
            { category_id: 20, status: "none", amount: null },
          ],
        },
      }),
      ...createPaymentHandlers(),
    )

    const totals = await fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")])

    expect(totals.find((total) => total.key === "category:10")).toMatchObject({
      budgetStatus: "amount",
      budgetAmount: 0,
      budgetDifference: -1000,
    })
    expect(totals.find((total) => total.key === "category:20")).toMatchObject({
      budgetStatus: "none",
      budgetAmount: null,
      budgetDifference: null,
    })
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

  it("予算レスポンスshapeが不正ならエラーにする", async () => {
    server.use(
      http.post("*/rest/v1/rpc/get_effective_category_budgets", () => {
        return HttpResponse.json([{ category_id: 10, status: "amount", amount: null }])
      }),
    )

    await expect(
      fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")]),
    ).rejects.toThrow("Invalid category budget response")
  })
})
