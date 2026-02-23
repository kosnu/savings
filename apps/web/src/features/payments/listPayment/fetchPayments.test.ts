import { describe, expect, it, vi } from "vitest"
import { fetchPayments } from "./fetchPayments"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: "test-access-token",
          },
        },
        error: null,
      }),
    },
  }),
}))

describe("fetchPayments", () => {
  it("DTOをPaymentドメインオブジェクトに変換する", async () => {
    const payments = await fetchPayments([null, null])

    expect(payments).toHaveLength(4)
    expect(payments[0]).toEqual({
      id: "1ksjdJK9CDYBHbWe2FmU",
      categoryId: "VgtuFszVjxOlwM040cyf",
      note: "コンビニ",
      amount: 1000,
      date: new Date("2025-06-01T00:00:00.000Z"),
      userId: "test-user-id",
      createdDate: new Date("2025-06-01T00:00:00.000Z"),
      updatedDate: new Date("2025-06-01T00:00:00.000Z"),
    })
  })

  it("date, createdAt, updatedAtをDateオブジェクトに変換する", async () => {
    const payments = await fetchPayments([null, null])

    for (const payment of payments) {
      expect(payment.date).toBeInstanceOf(Date)
      expect(payment.createdDate).toBeInstanceOf(Date)
      expect(payment.updatedDate).toBeInstanceOf(Date)
    }
  })

  it("nullのcategoryIdを空文字に変換する", async () => {
    const payments = await fetchPayments([null, null])

    for (const payment of payments) {
      expect(typeof payment.categoryId).toBe("string")
    }
  })

  it("nullのnoteを空文字に変換する", async () => {
    const payments = await fetchPayments([null, null])

    for (const payment of payments) {
      expect(typeof payment.note).toBe("string")
    }
  })
})
