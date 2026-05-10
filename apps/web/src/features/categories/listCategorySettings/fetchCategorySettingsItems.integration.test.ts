import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createCategorySettingsHandlers } from "../../../test/msw/handlers/categorySettings"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { fetchCategorySettingsItems } from "./fetchCategorySettingsItems"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

const foodCategoryWithBudgets = {
  id: 10,
  book_id: 1,
  name: "Food",
  category_budgets: [
    {
      id: 3,
      amount: 50000,
      effective_from: "2025-03-01",
      effective_year: 2025,
      effective_month: 3,
    },
  ],
  category_pins: [{ id: 100, category_id: 10 }],
}

const dailyNecessitiesCategoryWithoutBudget = {
  id: 20,
  book_id: 1,
  name: "Daily Necessities",
  category_budgets: [],
  category_pins: [],
}

describe("fetchCategorySettingsItems", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategorySettingsHandlers())
  })

  it("カテゴリ設定行を取得してカテゴリ別月予算とピン状態を正規化する", async () => {
    server.resetHandlers(
      ...createCategorySettingsHandlers({
        response: [foodCategoryWithBudgets, dailyNecessitiesCategoryWithoutBudget],
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
        latestCategoryBudget: {
          id: 3,
          amount: 50000,
          effectiveFrom: new Date(2025, 2, 1),
          effectiveYear: 2025,
          effectiveMonth: 3,
        },
        pinned: true,
      },
      {
        category: {
          id: 20,
          bookId: 1,
          name: "Daily Necessities",
        },
        latestCategoryBudget: null,
        pinned: false,
      },
    ])
  })

  it("カテゴリ起点の1 requestで必要な読み取り列を取得する", async () => {
    const requestCapture: { url: URL | null } = { url: null }
    let requestCount = 0

    server.use(
      http.get("*/rest/v1/categories*", ({ request }) => {
        requestCount += 1
        requestCapture.url = new URL(request.url)

        return HttpResponse.json([])
      }),
    )

    await fetchCategorySettingsItems()

    expect(requestCount).toBe(1)
    const select = requestCapture.url?.searchParams.get("select")
    expect(select).toContain("id")
    expect(select).toContain("book_id")
    expect(select).toContain("name")
    expect(select).toContain("category_budgets:category_budgets!category_budgets_category_id_fkey")
    expect(select).toContain("category_pins:category_pins!category_pins_category_id_fkey")
    expect(requestCapture.url?.searchParams.get("order")).toBe("id.asc")
    expect(requestCapture.url?.searchParams.get("category_budgets.order")).toBe(
      "effective_from.desc,id.desc",
    )
    expect(requestCapture.url?.searchParams.get("category_budgets.limit")).toBe("1")
    expect(requestCapture.url?.searchParams.get("category_pins.limit")).toBe("1")
    expect(requestCapture.url?.searchParams.has("book_id")).toBe(false)
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
            category_budgets: [],
            category_pins: [],
          },
        ])
      }),
    )

    await expect(fetchCategorySettingsItems()).rejects.toThrow("Invalid category settings response")
  })
})
