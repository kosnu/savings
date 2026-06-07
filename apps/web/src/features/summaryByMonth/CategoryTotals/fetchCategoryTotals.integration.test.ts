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
        budgetState: "amount",
        budgetAmount: 20000,
        kind: "category",
      },
      {
        key: "category:20",
        categoryId: 20,
        categoryName: "Daily Necessities",
        totalAmount: 4000,
        pinned: false,
        budgetState: "none",
        budgetAmount: null,
        kind: "category",
      },
      {
        key: "category:30",
        categoryId: 30,
        categoryName: "Entertainment",
        totalAmount: 0,
        pinned: false,
        budgetState: "unset",
        budgetAmount: null,
        kind: "category",
      },
      {
        key: "uncategorized",
        categoryId: null,
        categoryName: "Unknown",
        totalAmount: 0,
        pinned: false,
        budgetState: "unset",
        budgetAmount: null,
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

  it("カテゴリ別予算つき月次合計RPCに対象期間を送る", async () => {
    let requestBody: Record<string, unknown> | undefined
    let requestCount = 0
    server.use(
      http.post("*/rest/v1/rpc/get_category_totals_with_budgets", async ({ request }) => {
        requestCount += 1
        requestBody = (await request.json()) as Record<string, unknown>

        return HttpResponse.json([])
      }),
    )

    await fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")])

    expect(requestCount).toBe(1)
    expect(requestBody).toEqual({
      p_start_date: "2025-06-01",
      p_end_date: "2025-06-30",
    })
  })

  it("レスポンスshapeが不正ならエラーにする", async () => {
    server.use(
      http.post("*/rest/v1/rpc/get_category_totals_with_budgets", () => {
        return HttpResponse.json([
          {
            category_id: "invalid",
            category_name: "Food",
            total_amount: 1000,
            pinned: false,
            budget_state: "unset",
            budget_amount: null,
            kind: "category",
          },
        ])
      }),
    )

    await expect(
      fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")]),
    ).rejects.toThrow("Invalid category totals response")
  })

  it("予算状態のレスポンスshapeが不正ならエラーにする", async () => {
    server.use(
      http.post("*/rest/v1/rpc/get_category_totals_with_budgets", () => {
        return HttpResponse.json([
          {
            category_id: 10,
            category_name: "Food",
            total_amount: 1000,
            pinned: false,
            budget_state: "invalid",
            budget_amount: null,
            kind: "category",
          },
        ])
      }),
    )

    await expect(
      fetchCategoryTotals([new Date("2025-06-01"), new Date("2025-06-30")]),
    ).rejects.toThrow("Invalid category totals response")
  })
})
