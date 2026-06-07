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
  budget_state: "amount" as const,
  budget_amount: 20000,
}

const dailyNecessitiesCategory = {
  id: 20,
  book_id: 1,
  name: "Daily Necessities",
  category_pins: [],
  budget_state: "none" as const,
  budget_amount: null,
}

describe("fetchCategorySettingsItems", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategorySettingsHandlers())
  })

  it("カテゴリ設定行を取得してピン状態を正規化する", async () => {
    server.resetHandlers(
      ...createCategorySettingsHandlers({
        response: [foodCategoryPinned, dailyNecessitiesCategory],
      }),
    )

    const items = await fetchCategorySettingsItems()

    expect(items).toEqual([
      {
        category: {
          id: 10,
          bookId: 1,
          name: "Food",
          budget: { state: "amount", amount: 20000 },
        },
        pinned: true,
      },
      {
        category: {
          id: 20,
          bookId: 1,
          name: "Daily Necessities",
          budget: { state: "none", amount: null },
        },
        pinned: false,
      },
    ])
  })

  it("カテゴリ設定RPCの1 requestで必要な読み取り列を取得する", async () => {
    let requestCount = 0
    let requestUrl = ""

    server.use(
      http.post("*/rest/v1/rpc/list_category_settings_items", ({ request }) => {
        requestCount += 1
        requestUrl = request.url

        return HttpResponse.json([])
      }),
    )

    await fetchCategorySettingsItems()

    expect(requestCount).toBe(1)
    expect(requestUrl).toContain("/rest/v1/rpc/list_category_settings_items")
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
      http.post("*/rest/v1/rpc/list_category_settings_items", () => {
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
})
