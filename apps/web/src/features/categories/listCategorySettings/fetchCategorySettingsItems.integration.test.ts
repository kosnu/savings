import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createCategorySettingsHandlers } from "../../../test/msw/handlers/categorySettings"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { fetchCategorySettingsItems } from "./fetchCategorySettingsItems"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

const foodCategoryPinned = {
  id: 10,
  book_id: 1,
  name: "Food",
  category_pins: [{ id: 100, category_id: 10 }],
}

const dailyNecessitiesCategory = {
  id: 20,
  book_id: 1,
  name: "Daily Necessities",
  category_pins: [],
}

describe("fetchCategorySettingsItems", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategorySettingsHandlers())
  })

  it("カテゴリ設定行と有効予算を取得して正規化する", async () => {
    server.resetHandlers(
      ...createCategorySettingsHandlers({
        response: [foodCategoryPinned, dailyNecessitiesCategory],
        budgetResponse: [
          { category_id: 10, status: "amount", amount: 0 },
          { category_id: 20, status: "none", amount: null },
        ],
      }),
    )

    const items = await fetchCategorySettingsItems()

    expect(items).toEqual([
      {
        category: {
          id: 10,
          bookId: 1,
          name: "Food",
        },
        pinned: true,
        budgetStatus: "amount",
        budgetAmount: 0,
      },
      {
        category: {
          id: 20,
          bookId: 1,
          name: "Daily Necessities",
        },
        pinned: false,
        budgetStatus: "none",
        budgetAmount: null,
      },
    ])
  })

  it("カテゴリ起点の一覧と有効予算RPCを取得する", async () => {
    const requestCapture: { categoriesUrl: URL | null; budgetBody: unknown } = {
      categoriesUrl: null,
      budgetBody: null,
    }
    let categoriesRequestCount = 0
    let budgetRequestCount = 0

    server.use(
      http.get("*/rest/v1/categories*", ({ request }) => {
        categoriesRequestCount += 1
        requestCapture.categoriesUrl = new URL(request.url)

        return HttpResponse.json([])
      }),
      http.post("*/rest/v1/rpc/get_effective_category_budgets", async ({ request }) => {
        budgetRequestCount += 1
        requestCapture.budgetBody = await request.json()

        return HttpResponse.json([])
      }),
    )

    await fetchCategorySettingsItems()

    expect(categoriesRequestCount).toBe(1)
    expect(budgetRequestCount).toBe(1)
    const select = requestCapture.categoriesUrl?.searchParams.get("select")
    expect(select).toContain("id")
    expect(select).toContain("book_id")
    expect(select).toContain("name")
    expect(select).toContain("category_pins:category_pins!category_pins_category_id_fkey")
    expect(requestCapture.categoriesUrl?.searchParams.get("order")).toBe("id.asc")
    expect(requestCapture.categoriesUrl?.searchParams.get("category_pins.limit")).toBe("1")
    expect(requestCapture.categoriesUrl?.searchParams.has("book_id")).toBe(false)
    expect(requestCapture.budgetBody).toEqual({
      p_target_month: expect.any(String),
    })
  })

  it("Supabase がエラーを返した場合に throw する", async () => {
    server.resetHandlers(
      ...createCategorySettingsHandlers({
        error: true,
      }),
    )

    await expect(fetchCategorySettingsItems()).rejects.toThrow("Failed to fetch category settings.")
  })

  it("レスポンス shape が不正ならエラーにする", async () => {
    server.use(
      http.get("*/rest/v1/categories*", () => {
        return HttpResponse.json([
          {
            id: "invalid",
            book_id: 1,
            name: "Food",
            category_pins: [],
          },
        ])
      }),
    )

    await expect(fetchCategorySettingsItems()).rejects.toThrow("Invalid category settings response")
  })

  it("予算レスポンス shape が不正ならエラーにする", async () => {
    server.use(
      http.post("*/rest/v1/rpc/get_effective_category_budgets", () => {
        return HttpResponse.json([{ category_id: 10, status: "amount", amount: null }])
      }),
    )

    await expect(fetchCategorySettingsItems()).rejects.toThrow("Invalid category budget response")
  })
})
