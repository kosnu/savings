import { HttpResponse, http } from "msw"
import { describe, expect, it, vi } from "vite-plus/test"

import {
  createPaymentExportHandlers,
  exportPayment,
} from "../../../test/msw/handlers/paymentExports"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { fetchExportPayments, PaymentExportLimitError } from "./fetchExportPayments"

vi.mock("../../../lib/supabase", () => ({ getSupabaseClient: () => supabaseTestClient }))
const period = { startDate: "2026-10-01", endDate: "2026-10-31" }
const fetchRows = async () => fetchExportPayments(1, period, new AbortController().signal)

describe("CSV用支払い取得", () => {
  it("Book、開始・終了日の両端、安定した順序、exact countを指定しカテゴリ絞り込みを送らない", async () => {
    const requests: Request[] = []
    server.use(
      http.get("*/rest/v1/payments*", ({ request }) => {
        requests.push(request)
        return HttpResponse.json([exportPayment], { headers: { "Content-Range": "0-0/1" } })
      }),
    )
    expect(await fetchRows()).toEqual([exportPayment])
    expect(requests).toHaveLength(1)
    const url = new URL(requests[0].url)
    expect(url.searchParams.get("book_id")).toBe("eq.1")
    expect(url.searchParams.getAll("date")).toEqual(["gte.2026-10-01", "lte.2026-10-31"])
    expect(url.searchParams.get("order")).toBe("date.asc,id.asc")
    expect(url.searchParams.has("category_id")).toBe(false)
    expect(requests[0].headers.get("prefer")).toContain("count=exact")
    for (const column of [
      "category_id",
      "category:categories!payments_category_id_fkey",
      "book_id",
      "name",
    ]) {
      expect(url.searchParams.get("select")).toContain(column)
    }
  })

  it.each([1, 1000, 1001, 10_000])(
    "%i件を取得側の小さい上限でも重複・欠落なく全件取得する",
    async (count) => {
      const rows = Array.from({ length: count }, (_, index) => ({
        ...exportPayment,
        id: index + 1,
      }))
      let received = 0
      server.use(
        http.get("*/rest/v1/payments*", ({ request }) => {
          const url = new URL(request.url)
          expect(Number(url.searchParams.get("offset"))).toBe(received)
          expect(Number(url.searchParams.get("limit"))).toBeLessThanOrEqual(1000)
          const page = rows.slice(received, received + 400)
          const start = received
          received += page.length
          return HttpResponse.json(page, {
            headers: { "Content-Range": `${start}-${received - 1}/${count}` },
          })
        }),
      )
      expect(await fetchRows()).toEqual(rows)
      expect(received).toBe(count)
    },
  )

  it("10,001件以上なら最初の応答で拒否する", async () => {
    server.use(...createPaymentExportHandlers({ count: 10_001 }))
    await expect(fetchRows()).rejects.toBeInstanceOf(PaymentExportLimitError)
  })

  it("0件は正常な空結果として返す", async () => {
    server.use(...createPaymentExportHandlers({ response: [] }))
    expect(await fetchRows()).toEqual([])
  })

  it.each([
    { ...exportPayment, book_id: 2 },
    { ...exportPayment, date: "2026-09-30" },
    { ...exportPayment, date: "2026-11-01" },
    { ...exportPayment, date: "2026-02-30" },
    { ...exportPayment, amount: 1.5 },
    { ...exportPayment, category_id: 2, category: null },
    { ...exportPayment, category_id: 2, category: { id: 2, book_id: 2, name: "別Book" } },
    { ...exportPayment, category_id: null, category: undefined },
  ])("不正な行や参照をカテゴリ未設定と混同せず拒否する", async (row) => {
    server.use(
      http.get("*/rest/v1/payments*", () =>
        HttpResponse.json([row], { headers: { "Content-Range": "0-0/1" } }),
      ),
    )
    await expect(fetchRows()).rejects.toThrow()
  })

  it("総件数が不明な応答を成功にしない", async () => {
    server.use(http.get("*/rest/v1/payments*", () => HttpResponse.json([exportPayment])))
    await expect(fetchRows()).rejects.toThrow("Missing payment export count")
  })

  it.each(["error", "empty", "duplicate", "countChanged"])(
    "分割取得の途中の%sを成功にしない",
    async (failure) => {
      let calls = 0
      server.use(
        http.get("*/rest/v1/payments*", () => {
          calls++
          if (calls === 1)
            return HttpResponse.json([exportPayment], { headers: { "Content-Range": "0-0/2" } })
          if (failure === "error") return HttpResponse.json({ message: "Failed" }, { status: 500 })
          return HttpResponse.json(failure === "empty" ? [] : [exportPayment], {
            headers: { "Content-Range": `1-1/${failure === "countChanged" ? 3 : 2}` },
          })
        }),
      )
      await expect(fetchRows()).rejects.toThrow()
    },
  )
})
