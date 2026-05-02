import { HttpResponse, http } from "msw"
import { describe, expect, it, vi } from "vite-plus/test"

import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { fetchPayments } from "./fetchPayments"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("fetchPayments", () => {
  it("date, createdDate, updatedDateをDateオブジェクトに変換する", async () => {
    const payments = await fetchPayments([null, null])

    for (const payment of payments) {
      expect(payment.date).toBeInstanceOf(Date)
      expect(payment.createdDate).toBeInstanceOf(Date)
      expect(payment.updatedDate).toBeInstanceOf(Date)
    }
  })

  it("nullのcategory_idをnullに変換する", async () => {
    const payments = await fetchPayments([null, null])

    for (const payment of payments) {
      expect(payment.categoryId).toSatisfy((v) => v === null || typeof v === "number")
    }
  })

  it("nullのnoteを空文字に変換する", async () => {
    const payments = await fetchPayments([null, null])

    for (const payment of payments) {
      expect(typeof payment.note).toBe("string")
    }
  })

  it("startDateを指定するとそれ以降の支払いのみ返す", async () => {
    const payments = await fetchPayments([new Date("2025-04-01"), null])

    expect(payments).toHaveLength(3) // id:2, id:1, id:3
  })

  it("endDateを指定するとそれ以前の支払いのみ返す", async () => {
    const payments = await fetchPayments([null, new Date("2025-05-31")])

    expect(payments).toHaveLength(2) // id:3, id:4
  })

  it("startDate と endDate を両方指定すると範囲内のみ返す", async () => {
    const payments = await fetchPayments([new Date("2025-04-01"), new Date("2025-05-31")])

    expect(payments).toHaveLength(1) // id:3
  })

  it("登録済みカテゴリIDを指定するとcategory_idのeq条件を送る", async () => {
    const requestCapture: { url: URL | null } = { url: null }
    server.use(
      http.get("*/rest/v1/payments*", ({ request }) => {
        requestCapture.url = new URL(request.url)

        return HttpResponse.json([])
      }),
    )

    await fetchPayments([null, null], { categoryId: 10 })

    expect(requestCapture.url?.searchParams.get("category_id")).toBe("eq.10")
  })

  it("カテゴリ未設定を指定するとcategory_idのis null条件を送る", async () => {
    const requestCapture: { url: URL | null } = { url: null }
    server.use(
      http.get("*/rest/v1/payments*", ({ request }) => {
        requestCapture.url = new URL(request.url)

        return HttpResponse.json([])
      }),
    )

    await fetchPayments([null, null], { categoryId: null })

    expect(requestCapture.url?.searchParams.get("category_id")).toBe("is.null")
  })

  it("年月条件とカテゴリ条件を併用する", async () => {
    const requestCapture: { url: URL | null } = { url: null }
    server.use(
      http.get("*/rest/v1/payments*", ({ request }) => {
        requestCapture.url = new URL(request.url)

        return HttpResponse.json([])
      }),
    )

    await fetchPayments([new Date("2025-04-01"), new Date("2025-04-30")], { categoryId: 10 })

    expect(requestCapture.url?.searchParams.getAll("date")).toEqual([
      "gte.2025-04-01",
      "lte.2025-04-30",
    ])
    expect(requestCapture.url?.searchParams.get("category_id")).toBe("eq.10")
  })

  it("カテゴリ条件なしではcategory_id条件を送らない", async () => {
    const requestCapture: { url: URL | null } = { url: null }
    server.use(
      http.get("*/rest/v1/payments*", ({ request }) => {
        requestCapture.url = new URL(request.url)

        return HttpResponse.json([])
      }),
    )

    await fetchPayments([null, null])

    expect(requestCapture.url?.searchParams.has("category_id")).toBe(false)
  })
})
