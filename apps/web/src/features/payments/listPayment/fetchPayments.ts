import { toDateOnlyString } from "../../../domain/date"
import { getSupabaseClient } from "../../../lib/supabase"
import type { Payment } from "../../../types/payment"
import { toPayment } from "../paymentResponseMappers"

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
    query = query.gte("date", toDateOnlyString(startDate))
  }
  if (endDate) {
    query = query.lte("date", toDateOnlyString(endDate))
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

  return (data ?? []).map(toPayment)
}
