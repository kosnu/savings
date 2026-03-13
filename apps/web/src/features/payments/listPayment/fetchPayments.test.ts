import { describe, expect, it, vi } from "vitest"

import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { fetchPayments } from "./fetchPayments"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("fetchPayments", () => {
  it("DBの行をPaymentドメインオブジェクトに変換する", async () => {
    const payments = await fetchPayments([null, null])

    expect(payments).toHaveLength(4)
    expect(payments[0]).toEqual({
      id: 2,
      categoryId: 20,
      note: "コンビニ",
      amount: 4000,
      date: new Date("2025-06-02"),
      userId: 100,
      createdDate: new Date("2025-06-02T00:00:00.000Z"),
      updatedDate: new Date("2025-06-02T00:00:00.000Z"),
    })
  })

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
})
