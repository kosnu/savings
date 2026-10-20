import * as z from "zod"

import { getSupabaseClient } from "../../../lib/supabase"
import {
  exportPaymentsSchema,
  PAYMENT_EXPORT_LIMIT,
  type ExportPaymentsPeriod,
} from "./exportPaymentsSchema"

const exportPaymentSchema = z.object({
  id: z.number().int(),
  book_id: z.number().int(),
  date: z.iso.date(),
  amount: z.number().int().nonnegative(),
  note: z.string().nullable(),
  category_id: z.number().int().nullable(),
  category: z
    .object({ id: z.number().int(), book_id: z.number().int(), name: z.string() })
    .nullable(),
})

export type ExportPayment = z.infer<typeof exportPaymentSchema>

export class PaymentExportLimitError extends Error {
  constructor() {
    super("Payment export limit exceeded")
  }
}

export async function fetchExportPayments(
  bookId: number,
  period: ExportPaymentsPeriod,
  signal: AbortSignal,
): Promise<ExportPayment[]> {
  const { startDate, endDate } = exportPaymentsSchema.parse(period)
  const supabase = getSupabaseClient()
  const payments: ExportPayment[] = []
  const ids = new Set<number>()
  let total: number | undefined

  do {
    const { data, error, count } = await supabase
      .from("payments")
      .select(
        "id,book_id,date,amount,note,category_id,category:categories!payments_category_id_fkey(id,book_id,name)",
        { count: "exact" },
      )
      .eq("book_id", bookId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(payments.length, Math.min(payments.length + 999, PAYMENT_EXPORT_LIMIT - 1))
      .abortSignal(signal)

    if (error) throw error
    if (count === null || !Number.isSafeInteger(count) || count < 0) {
      throw new Error("Missing payment export count")
    }
    if (count > PAYMENT_EXPORT_LIMIT) throw new PaymentExportLimitError()
    if (total !== undefined && total !== count) throw new Error("Payments changed during export")
    total = count

    const rows = z.array(exportPaymentSchema).parse(data)
    if ((rows.length === 0 && payments.length < total) || payments.length + rows.length > total) {
      throw new Error("Incomplete payment export response")
    }
    for (const row of rows) {
      if (
        row.book_id !== bookId ||
        row.date < startDate ||
        row.date > endDate ||
        ids.has(row.id) ||
        (row.category_id === null
          ? row.category !== null
          : row.category === null ||
            row.category.id !== row.category_id ||
            row.category.book_id !== bookId)
      ) {
        throw new Error("Invalid payment export response")
      }
      ids.add(row.id)
      payments.push(row)
    }
  } while (payments.length < total)

  return payments
}
