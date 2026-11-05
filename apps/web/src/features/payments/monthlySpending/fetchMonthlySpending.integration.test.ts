import { HttpResponse, http } from "msw"
import { expect, test } from "vite-plus/test"

import { server } from "../../../test/msw/server"
import { fetchMonthlySpending } from "./fetchMonthlySpending"

test("月・Book・取得列を指定し、API上限を越える明細をページ分割して欠落なく取得する", async () => {
  const pages: number[] = []
  const rows = Array.from({ length: 1001 }, (_, i) => ({
    id: i + 1,
    book_id: 7,
    date: "2024-02-29",
    amount: 10,
  }))
  server.use(
    http.get("*/rest/v1/payments", ({ request }) => {
      const params = new URL(request.url).searchParams
      expect(params.get("book_id")).toBe("eq.7")
      expect(params.getAll("date")).toEqual(["gte.2024-02-01", "lte.2024-02-29"])
      expect(params.get("select")?.split(",").sort()).toEqual(["amount", "book_id", "date", "id"])
      expect(params.get("order")).toBe("id.asc")
      expect(params.get("limit")).toBe("500")
      expect(request.headers.get("prefer")).toContain("count=exact")
      const offset = Number(params.get("offset"))
      pages.push(offset)
      const page = rows.slice(offset, offset + 500)
      return HttpResponse.json(page, {
        headers: { "Content-Range": `${offset}-${offset + page.length - 1}/1001` },
      })
    }),
  )
  const result = await fetchMonthlySpending(7, "2024-02", new AbortController().signal)
  expect(pages).toEqual([0, 500, 1000])
  expect(result).toHaveLength(1001)
  expect(result.reduce((sum, row) => sum + row.amount, 0)).toBe(10010)
})

test.each([
  { name: "別Book", data: [{ id: 1, book_id: 2, date: "2025-06-01", amount: 100 }] },
  { name: "月外", data: [{ id: 1, book_id: 1, date: "2025-07-01", amount: 100 }] },
  { name: "不正金額", data: [{ id: 1, book_id: 1, date: "2025-06-01", amount: -1 }] },
  {
    name: "重複",
    data: [
      { id: 1, book_id: 1, date: "2025-06-01", amount: 100 },
      { id: 1, book_id: 1, date: "2025-06-02", amount: 100 },
    ],
  },
])("$name の応答を0円や正常な集計として返さない", async ({ data }) => {
  server.use(
    http.get("*/rest/v1/payments", () =>
      HttpResponse.json(data, {
        headers: { "Content-Range": `0-${data.length - 1}/${data.length}` },
      }),
    ),
  )
  await expect(fetchMonthlySpending(1, "2025-06", new AbortController().signal)).rejects.toThrow()
})

test("途中ページの取得失敗で部分的な合計を返さない", async () => {
  let requests = 0
  server.use(
    http.get("*/rest/v1/payments", () => {
      requests += 1
      if (requests === 2) return HttpResponse.json({ message: "failed" }, { status: 500 })
      return HttpResponse.json([{ id: 1, book_id: 1, date: "2025-06-01", amount: 100 }], {
        headers: { "Content-Range": "0-0/2" },
      })
    }),
  )
  await expect(
    fetchMonthlySpending(1, "2025-06", new AbortController().signal),
  ).rejects.toBeDefined()
  expect(requests).toBe(2)
})

test("件数不足を空や正常な集計として返さない", async () => {
  server.use(
    http.get("*/rest/v1/payments", () =>
      HttpResponse.json([], { headers: { "Content-Range": "*/2" } }),
    ),
  )
  await expect(fetchMonthlySpending(1, "2025-06", new AbortController().signal)).rejects.toThrow(
    "Incomplete",
  )
})
