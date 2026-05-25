import * as z from "zod"

import { parseDateOnlyStringToLocalDate } from "../../../domain/date"
import { getSupabaseClient } from "../../../lib/supabase"
import type { PaymentDetails, PaymentId } from "../../../types/payment"

const paymentCategorySchema = z
  .object({
    id: z.number(),
    name: z.string(),
  })
  .nullable()

const paymentDetailsRowSchema = z.object({
  id: z.number(),
  note: z.string().nullable(),
  amount: z.number(),
  date: z.string(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  book_id: z.number(),
  category: paymentCategorySchema,
})

type PaymentDetailsRow = z.infer<typeof paymentDetailsRowSchema>

export async function fetchPaymentDetails(paymentId: PaymentId): Promise<PaymentDetails | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("payments")
    .select(
      `
        id,
        note,
        amount,
        date,
        created_at,
        updated_at,
        book_id,
        category:categories!payments_category_id_fkey (
          id,
          name
        )
      `,
    )
    .eq("id", paymentId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  const row = normalizePaymentDetailsRow(data)

  return {
    id: row.id,
    note: row.note ?? "",
    amount: row.amount,
    date: parseDateOnlyStringToLocalDate(row.date),
    bookId: row.book_id,
    createdDate: row.created_at ? new Date(row.created_at) : new Date(),
    updatedDate: row.updated_at ? new Date(row.updated_at) : new Date(),
    category: row.category,
  }
}

function normalizePaymentDetailsRow(value: unknown): PaymentDetailsRow {
  const result = paymentDetailsRowSchema.safeParse(value)

  if (!result.success) {
    throw new Error("Invalid payment details response")
  }

  return result.data
}
