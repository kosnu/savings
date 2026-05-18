import { format } from "date-fns"
import * as z from "zod"

import { getSupabaseClient } from "../../../lib/supabase"
import type { Payment } from "../../../types/payment"

const paymentCategorySchema = z
  .object({
    id: z.number(),
    name: z.string(),
  })
  .nullable()

const paymentRowSchema = z.object({
  id: z.number(),
  note: z.string().nullable(),
  amount: z.number(),
  date: z.string(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  book_id: z.number(),
  category: paymentCategorySchema.optional(),
})

type PaymentRow = z.infer<typeof paymentRowSchema>

interface FetchPaymentsOptions {
  categoryId?: number | null
}

export async function fetchPayments(
  [startDate, endDate]: [Date | null, Date | null],
  { categoryId }: FetchPaymentsOptions = {},
): Promise<Payment[]> {
  const supabase = getSupabaseClient()
  let query = supabase
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
    .order("date", { ascending: false })
    .order("id", { ascending: false })

  if (startDate) {
    query = query.gte("date", format(startDate, "yyyy-MM-dd"))
  }
  if (endDate) {
    query = query.lte("date", format(endDate, "yyyy-MM-dd"))
  }
  if (typeof categoryId === "number") {
    query = query.eq("category_id", categoryId)
  }
  if (categoryId === null) {
    query = query.is("category_id", null)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []).map((value) => {
    const row = normalizePaymentRow(value)

    return {
      id: row.id,
      categoryId: row.category?.id ?? null,
      category: row.category ?? null,
      note: row.note ?? "",
      amount: row.amount,
      date: new Date(row.date),
      bookId: row.book_id,
      createdDate: row.created_at ? new Date(row.created_at) : new Date(),
      updatedDate: row.updated_at ? new Date(row.updated_at) : new Date(),
    }
  })
}

function normalizePaymentRow(value: unknown): PaymentRow {
  const result = paymentRowSchema.safeParse(value)

  if (!result.success) {
    throw new Error("Invalid payment response")
  }

  return result.data
}
