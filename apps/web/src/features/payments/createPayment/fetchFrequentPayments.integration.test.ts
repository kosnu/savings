import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import type { PaymentRow } from "../../../types/payment"
import { fetchFrequentPayments } from "./fetchFrequentPayments"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

const dateRange = {
  bookId: 1,
  startDate: "2026-06-25",
  endDate: "2026-07-25",
}

function createPaymentRow(id: number, overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id,
    note: "Lunch",
    amount: 1200,
    date: "2026-07-01",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    book_id: 1,
    category_id: 10,
    ...overrides,
  }
}

describe("fetchFrequentPayments", () => {
  beforeEach(() => {
    server.resetHandlers(...createPaymentHandlers())
  })

  test("期間内のresponseを完全一致で集計して候補を返す", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        get: {
          response: [
            createPaymentRow(1),
            createPaymentRow(2),
            createPaymentRow(3),
            createPaymentRow(4, { amount: 1300 }),
          ],
        },
      }),
    )

    await expect(fetchFrequentPayments(dateRange)).resolves.toEqual([
      {
        note: "Lunch",
        amount: 1200,
        categoryId: 10,
        categoryName: "Food",
        count: 3,
      },
    ])
  })

  test("必要なcolumn・relationとBook・inclusiveなdate filterを送る", async () => {
    const requestCapture: { url: URL | null } = { url: null }
    server.use(
      http.get("*/rest/v1/payments*", ({ request }) => {
        requestCapture.url = new URL(request.url)
        return HttpResponse.json([])
      }),
    )

    await fetchFrequentPayments(dateRange)

    const select = requestCapture.url?.searchParams.get("select")
    expect(select).toContain("note")
    expect(select).toContain("amount")
    expect(select).toContain("category_id")
    expect(select).toContain("book_id")
    expect(select).toContain("category:categories!payments_category_id_fkey")
    const categorySelect = select?.match(
      /category:categories!payments_category_id_fkey\(([^)]*)\)/,
    )?.[1]
    expect(categorySelect).toContain("id")
    expect(categorySelect).toContain("book_id")
    expect(categorySelect).toContain("name")
    expect(requestCapture.url?.searchParams.get("book_id")).toBe("eq.1")
    expect(requestCapture.url?.searchParams.getAll("date")).toEqual([
      "gte.2026-06-25",
      "lte.2026-07-25",
    ])
  })

  test("Supabase errorをそのままthrowする", async () => {
    server.resetHandlers(...createPaymentHandlers({ get: { error: true } }))

    await expect(fetchFrequentPayments(dateRange)).rejects.toBeDefined()
  })

  test("不正なresponseを空候補として扱わない", async () => {
    server.use(
      http.get("*/rest/v1/payments*", () =>
        HttpResponse.json([{ note: "Lunch", amount: "1200", category_id: 10 }]),
      ),
    )

    await expect(fetchFrequentPayments(dateRange)).rejects.toThrow(
      "Invalid frequent payments response",
    )
  })

  test("指定Bookと異なる支払いを空候補として扱わない", async () => {
    server.use(
      http.get("*/rest/v1/payments*", () =>
        HttpResponse.json([
          {
            book_id: 2,
            note: "Lunch",
            amount: 1200,
            category_id: null,
            category: null,
          },
        ]),
      ),
    )

    await expect(fetchFrequentPayments(dateRange)).rejects.toThrow(
      "Invalid frequent payments response",
    )
  })

  test("支払いと異なるBookのカテゴリrelationを空候補として扱わない", async () => {
    server.use(
      http.get("*/rest/v1/payments*", () =>
        HttpResponse.json([
          {
            book_id: 1,
            note: "Lunch",
            amount: 1200,
            category_id: 10,
            category: {
              id: 10,
              book_id: 2,
              name: "Other Food",
            },
          },
        ]),
      ),
    )

    await expect(fetchFrequentPayments(dateRange)).rejects.toThrow(
      "Invalid frequent payments response",
    )
  })
})
