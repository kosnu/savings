import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createBookHandlers } from "../../../test/msw/handlers/books"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { fetchCurrentBook } from "./fetchCurrentBook"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("fetchCurrentBook", () => {
  beforeEach(() => {
    server.resetHandlers(...createBookHandlers())
  })

  it("現在のdefault bookを取得する", async () => {
    server.resetHandlers(
      ...createBookHandlers({
        response: {
          book_id: 42,
          is_default: true,
          books: { id: 42, name: "Family Book" },
        },
      }),
    )

    await expect(fetchCurrentBook()).resolves.toEqual({ id: 42, name: "Family Book" })
  })

  it("default membershipに絞り、必要なBook情報だけを取得する", async () => {
    let requestUrl: URL | undefined

    server.use(
      http.get("*/rest/v1/book_members*", ({ request }) => {
        requestUrl = new URL(request.url)
        return HttpResponse.json({
          book_id: 1,
          is_default: true,
          books: { id: 1, name: "Default Book" },
        })
      }),
    )

    await fetchCurrentBook()

    expect(requestUrl?.searchParams.get("is_default")).toBe("eq.true")
    expect(requestUrl?.searchParams.get("select")).toBe(
      "book_id,is_default,books!book_members_book_id_fkey(id,name)",
    )
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    server.resetHandlers(...createBookHandlers({ error: true }))

    await expect(fetchCurrentBook()).rejects.toThrow("Failed to fetch current book.")
  })

  it("レスポンスshapeが不正ならエラーにする", async () => {
    server.use(
      http.get("*/rest/v1/book_members*", () => {
        return HttpResponse.json({
          book_id: 1,
          is_default: true,
          books: { id: 2, name: "Wrong Book" },
        })
      }),
    )

    await expect(fetchCurrentBook()).rejects.toThrow("Invalid current book response")
  })
})
