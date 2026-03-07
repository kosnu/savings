import { HttpResponse, http } from "msw"
import type { PaymentRow } from "../../../types/payment"

const EDGE_FUNCTION_URL = "*/functions/v1/payments"
const REST_URL = "*/rest/v1/payments*"

const paymentRows: PaymentRow[] = [
  {
    id: 1,
    category_id: 10,
    user_id: 100,
    date: "2025-06-01",
    note: "コンビニ",
    amount: 1000,
    created_at: "2025-06-01T00:00:00.000Z",
    updated_at: "2025-06-01T00:00:00.000Z",
  },
  {
    id: 2,
    category_id: 20,
    user_id: 100,
    date: "2025-06-02",
    note: "コンビニ",
    amount: 4000,
    created_at: "2025-06-02T00:00:00.000Z",
    updated_at: "2025-06-02T00:00:00.000Z",
  },
  {
    id: 3,
    category_id: 10,
    user_id: 100,
    date: "2025-04-01",
    note: "スーパー",
    amount: 4000,
    created_at: "2025-04-01T00:00:00.000Z",
    updated_at: "2025-04-01T00:00:00.000Z",
  },
  {
    id: 4,
    category_id: 30,
    user_id: 100,
    date: "2025-03-01",
    note: "コンビニ",
    amount: 1000,
    created_at: "2025-03-01T00:00:00.000Z",
    updated_at: "2025-03-01T00:00:00.000Z",
  },
]

export const paymentHandlers = [
  http.get(REST_URL, ({ request }) => {
    const url = new URL(request.url)
    const dateFilters = url.searchParams.getAll("date")

    const from = dateFilters
      .find((value) => value.startsWith("gte."))
      ?.replace("gte.", "")
    const to = dateFilters
      .find((value) => value.startsWith("lte."))
      ?.replace("lte.", "")

    const filteredRows = paymentRows.filter((row) => {
      if (from && row.date < from) {
        return false
      }
      if (to && row.date > to) {
        return false
      }
      return true
    })

    const sorted = [...filteredRows].sort((a, b) => {
      if (b.date !== a.date) return b.date < a.date ? -1 : 1
      return b.id - a.id
    })
    return HttpResponse.json(sorted)
  }),

  http.post(REST_URL, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const now = new Date().toISOString()
    const newRow: PaymentRow = {
      id: 5,
      note: (body.note as string) ?? null,
      amount: body.amount as number,
      date: body.date as string,
      created_at: now,
      updated_at: now,
      category_id: body.category_id != null ? Number(body.category_id) : null,
      user_id: 100,
    }
    return HttpResponse.json([newRow], { status: 201 })
  }),

  http.get(`${EDGE_FUNCTION_URL}/total`, () => {
    return HttpResponse.json({ totalAmount: 10000, month: "2025-06" })
  }),

  http.delete(`${EDGE_FUNCTION_URL}/:id`, () => {
    return HttpResponse.json({ message: "Not Implemented" }, { status: 501 })
  }),
]
