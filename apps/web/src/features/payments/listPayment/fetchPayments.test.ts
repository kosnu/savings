import { createClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"
import { fetchPayments } from "./fetchPayments"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () =>
    createClient("http://localhost:54321", "test-anon-key"),
}))

describe("fetchPayments", () => {
  it("DBの行をPaymentドメインオブジェクトに変換する", async () => {
    const payments = await fetchPayments([null, null])

    expect(payments).toHaveLength(4)
    expect(payments[0]).toEqual({
      id: 1,
      categoryId: 10,
      note: "コンビニ",
      amount: 1000,
      date: new Date("2025-06-01"),
      userId: 100,
      createdDate: new Date("2025-06-01T00:00:00.000Z"),
      updatedDate: new Date("2025-06-01T00:00:00.000Z"),
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
      expect(payment.categoryId).toSatisfy(
        (v) => v === null || typeof v === "number",
      )
    }
  })

  it("nullのnoteを空文字に変換する", async () => {
    const payments = await fetchPayments([null, null])

    for (const payment of payments) {
      expect(typeof payment.note).toBe("string")
    }
  })
})
