import { HttpResponse, http } from "msw"

const BASE_URL = "http://localhost:54321/functions/v1/payments"

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

const paymentDtos: PaymentDto[] = [
  {
    id: "1ksjdJK9CDYBHbWe2FmU",
    categoryId: "VgtuFszVjxOlwM040cyf",
    userId: "test-user-id",
    date: "2025-06-01T00:00:00.000Z",
    note: "コンビニ",
    amount: 1000,
    createdAt: "2025-06-01T00:00:00.000Z",
    updatedAt: "2025-06-01T00:00:00.000Z",
  },
  {
    id: "0GRbtELIWmRT1biPdusF",
    categoryId: "eq1duDRDUKJTFZac1Ztp",
    userId: "test-user-id",
    date: "2025-06-02T00:00:00.000Z",
    note: "コンビニ",
    amount: 4000,
    createdAt: "2025-06-02T00:00:00.000Z",
    updatedAt: "2025-06-02T00:00:00.000Z",
  },
  {
    id: "5PPuNUCWE2Sf7ZoOJ6VM",
    categoryId: "VgtuFszVjxOlwM040cyf",
    userId: "test-user-id",
    date: "2025-04-01T00:00:00.000Z",
    note: "スーパー",
    amount: 4000,
    createdAt: "2025-04-01T00:00:00.000Z",
    updatedAt: "2025-04-01T00:00:00.000Z",
  },
  {
    id: "IadZXL3y4triLDhPP5hd",
    categoryId: "Pdgee5Sp6vhRanU3gEv0",
    userId: "test-user-id",
    date: "2025-03-01T00:00:00.000Z",
    note: "コンビニ",
    amount: 1000,
    createdAt: "2025-03-01T00:00:00.000Z",
    updatedAt: "2025-03-01T00:00:00.000Z",
  },
]

export const paymentHandlers = [
  http.get(BASE_URL, () => {
    return HttpResponse.json({ payments: paymentDtos })
  }),

  http.post(BASE_URL, async ({ request }) => {
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

  http.get(`${BASE_URL}/total`, () => {
    return HttpResponse.json({ totalAmount: 10000, month: "2025-06" })
  }),
]
