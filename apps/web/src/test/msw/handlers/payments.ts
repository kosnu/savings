import { HttpResponse, http } from "msw"

const EDGE_FUNCTION_URL = "*/functions/v1/payments"
const REST_URL = "*/rest/v1/payments*"

export interface PaymentDto {
  id: string
  note: string | null
  amount: number
  date: string
  createdAt: string | null
  updatedAt: string | null
  categoryId: string | null
  userId: string
}

interface PaymentRow {
  id: number
  note: string | null
  amount: number
  date: string
  created_at: string | null
  updated_at: string | null
  category_id: number | null
  user_id: number
}

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
  http.get(REST_URL, () => {
    return HttpResponse.json(paymentRows)
  }),

  http.post(EDGE_FUNCTION_URL, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const newPayment: PaymentDto = {
      id: "new-payment-id",
      note: (body.note as string) ?? null,
      amount: body.amount as number,
      date: body.date as string,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      categoryId: (body.categoryId as string) ?? null,
      userId: "test-user-id",
    }
    return HttpResponse.json({ payment: newPayment }, { status: 201 })
  }),

  http.get(`${EDGE_FUNCTION_URL}/total`, () => {
    return HttpResponse.json({ totalAmount: 10000, month: "2025-06" })
  }),

  http.delete(`${EDGE_FUNCTION_URL}/:id`, () => {
    return HttpResponse.json({ message: "Not Implemented" }, { status: 501 })
  }),
]
