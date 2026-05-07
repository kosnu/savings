import { HttpResponse, http } from "msw"
import { describe, expect, it, vi } from "vite-plus/test"

import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { fetchCategories } from "./fetchCategories"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("fetchCategories", () => {
  it("DTOをCategoryドメインオブジェクトに変換する", async () => {
    const categories = await fetchCategories()

    expect(categories).toHaveLength(3)
    expect(categories[0]).toEqual({
      id: 10,
      bookId: 1,
      name: "Food",
      createdDate: new Date("2025-01-01T00:00:00.000Z"),
      updatedDate: new Date("2025-01-01T00:00:00.000Z"),
    })
    expect(categories[1]).toEqual({
      id: 20,
      bookId: 1,
      name: "Daily Necessities",
      createdDate: new Date("2025-01-01T00:00:00.000Z"),
      updatedDate: new Date("2025-01-01T00:00:00.000Z"),
    })
    expect(categories[2]).toEqual({
      id: 30,
      bookId: 1,
      name: "Entertainment",
      createdDate: new Date("2025-01-01T00:00:00.000Z"),
      updatedDate: new Date("2025-01-01T00:00:00.000Z"),
    })
  })

  it("createdAt/updatedAtをDateオブジェクトに変換する", async () => {
    const categories = await fetchCategories()

    for (const category of categories) {
      expect(category.createdDate).toBeInstanceOf(Date)
      expect(category.updatedDate).toBeInstanceOf(Date)
    }
  })

  it("member book RLS 後のカテゴリだけを取得する", async () => {
    server.resetHandlers(
      ...createCategoryHandlers({
        get: {
          currentBookId: 2,
        },
      }),
    )

    const categories = await fetchCategories()

    expect(categories).toEqual([
      {
        id: 40,
        bookId: 2,
        name: "Food",
        createdDate: new Date("2025-01-01T00:00:00.000Z"),
        updatedDate: new Date("2025-01-01T00:00:00.000Z"),
      },
    ])
  })

  it("book_idを取得し、Webからbook_id条件は送らない", async () => {
    const requestCapture: { url: URL | null } = { url: null }
    server.use(
      http.get("*/rest/v1/categories*", ({ request }) => {
        requestCapture.url = new URL(request.url)

        return HttpResponse.json([])
      }),
    )

    await fetchCategories()

    expect(requestCapture.url?.searchParams.get("select")).toBe(
      "id,name,book_id,created_at,updated_at",
    )
    expect(requestCapture.url?.searchParams.has("book_id")).toBe(false)
  })
})
