import * as z from "zod"

import { parseDateOnlyStringToLocalDate } from "../../domain/date"
import type { Payment, PaymentDetails } from "../../types/payment"

const paymentCategoryResponseSchema = z
  .object({
    id: z.number(),
    name: z.string(),
  })
  .nullable()

const paymentResponseSchema = z.object({
  id: z.number(),
  note: z.string().nullable(),
  amount: z.number(),
  date: z.string(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  book_id: z.number(),
})

const paymentListResponseSchema = paymentResponseSchema.extend({
  category: paymentCategoryResponseSchema.optional(),
})

const paymentDetailsResponseSchema = paymentResponseSchema.extend({
  category: paymentCategoryResponseSchema,
})

type PaymentResponse = z.infer<typeof paymentResponseSchema>

export function toPayment(value: unknown): Payment {
  const result = paymentListResponseSchema.safeParse(value)

  if (!result.success) {
    throw new Error("Invalid payment response")
  }

  const row = result.data

  return {
    ...toCommonPayment(row),
    categoryId: row.category?.id ?? null,
    category: row.category ?? null,
  }
}

export function toPaymentDetails(value: unknown): PaymentDetails {
  const result = paymentDetailsResponseSchema.safeParse(value)

  if (!result.success) {
    throw new Error("Invalid payment details response")
  }

  const row = result.data

  return {
    ...toCommonPayment(row),
    category: row.category,
  }
}

function toCommonPayment(row: PaymentResponse) {
  return {
    id: row.id,
    note: row.note ?? "",
    amount: row.amount,
    date: parseDateOnlyStringToLocalDate(row.date),
    bookId: row.book_id,
    createdDate: row.created_at ? new Date(row.created_at) : new Date(),
    updatedDate: row.updated_at ? new Date(row.updated_at) : new Date(),
  }
}
