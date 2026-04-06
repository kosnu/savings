import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { payments } from "../../../test/data/payments"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import { fetchPaymentDetails } from "./fetchPaymentDetails"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("fetchPaymentDetails", () => {
  beforeEach(() => {
    server.resetHandlers(...createPaymentHandlers())
  })

  it("支払い詳細とカテゴリを 1 件取得して Date に変換する", async () => {
    const payment = await fetchPaymentDetails(1)

    expect(payment).not.toBeNull()
    expect(payment?.id).toBe(1)
    expect(payment?.date).toBeInstanceOf(Date)
    expect(payment?.createdDate).toBeInstanceOf(Date)
    expect(payment?.updatedDate).toBeInstanceOf(Date)
    expect(payment?.category).toEqual({
      id: 10,
      name: "Food",
    })
  })

  it("カテゴリ未設定の支払いは category を null にする", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        initialRows: [
          {
            ...mapPaymentToRow(payments[0]),
            category_id: null,
          },
        ],
      }),
    )

    const payment = await fetchPaymentDetails(1)

    expect(payment).not.toBeNull()
    expect(payment?.category).toBeNull()
  })

  it("対象が存在しないときは null を返す", async () => {
    const payment = await fetchPaymentDetails(999)

    expect(payment).toBeNull()
  })

  it("レスポンス shape が不正ならエラーにする", async () => {
    server.use(
      http.get("*/rest/v1/payments*", () => {
        return HttpResponse.json({
          id: "invalid",
          amount: 1000,
          date: "2025-06-02",
          user_id: 100,
          category: null,
        })
      }),
    )

    await expect(fetchPaymentDetails(1)).rejects.toThrow("Invalid payment details response")
  })
})
