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
  const { data, error } = await supabase
    .rpc("export_payments", {
      p_book_id: bookId,
      p_start_date: startDate,
      p_end_date: endDate,
    })
    .abortSignal(signal)
  if (error) throw error
  const response = z
    .object({
      count: z
        .number()
        .int()
        .min(0)
        .max(PAYMENT_EXPORT_LIMIT + 1),
      payments: z.array(exportPaymentSchema).max(PAYMENT_EXPORT_LIMIT),
    })
    .parse(data)
  if (response.count > PAYMENT_EXPORT_LIMIT) throw new PaymentExportLimitError()
  if (response.payments.length !== response.count) {
    throw new Error("Incomplete payment export response")
  }
  const ids = new Set<number>()
  for (const row of response.payments) {
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
  }
  return response.payments
}
