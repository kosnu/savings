import * as z from "zod"

import { getSupabaseClient } from "../../../lib/supabase"
import { findFrequentPayments, type FrequentPayment } from "./frequentPayment"

const frequentPaymentRowsSchema = z.array(
  z
    .object({
      book_id: z.number(),
      note: z.string().nullable(),
      amount: z.number(),
      category_id: z.number().nullable(),
      category: z
        .object({
          id: z.number(),
          book_id: z.number(),
          name: z.string(),
        })
        .nullable(),
    })
    .superRefine((row, context) => {
      if (row.category_id === null && row.category !== null) {
        context.addIssue({
          code: "custom",
          message: "Category relation must be null when category_id is null",
        })
      }
      if (row.category_id !== null && row.category?.id !== row.category_id) {
        context.addIssue({
          code: "custom",
          message: "Category relation must match category_id",
        })
      }
    }),
)

interface FetchFrequentPaymentsOptions {
  bookId: number
  startDate: string
  endDate: string
}

export async function fetchFrequentPayments({
  bookId,
  startDate,
  endDate,
}: FetchFrequentPaymentsOptions): Promise<FrequentPayment[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("payments")
    .select(
      `
        book_id,
        note,
        amount,
        category_id,
        category:categories!payments_category_id_fkey (
          id,
          book_id,
          name
        )
      `,
    )
    .eq("book_id", bookId)
    .gte("date", startDate)
    .lte("date", endDate)

  if (error) {
    throw error
  }

  const result = frequentPaymentRowsSchema.safeParse(data)
  if (!result.success) {
    throw new Error("Invalid frequent payments response")
  }

  if (
    result.data.some(
      (row) => row.book_id !== bookId || (row.category !== null && row.category.book_id !== bookId),
    )
  ) {
    throw new Error("Invalid frequent payments response")
  }

  return findFrequentPayments(
    result.data.map((row) => ({
      note: row.note,
      amount: row.amount,
      categoryId: row.category_id,
      categoryName: row.category?.name ?? null,
    })),
  )
}
