import { format } from "date-fns"

import { getSupabaseClient } from "../../../lib/supabase"
import type { Payment } from "../../../types/payment"

export async function fetchPayments([startDate, endDate]: [Date | null, Date | null]): Promise<
  Payment[]
> {
  const supabase = getSupabaseClient()
  let query = supabase
    .from("payments")
    .select("id, note, amount, date, created_at, updated_at, category_id, user_id")
    .order("date", { ascending: false })
    .order("id", { ascending: false })

  if (startDate) {
    query = query.gte("date", format(startDate, "yyyy-MM-dd"))
  }
  if (endDate) {
    query = query.lte("date", format(endDate, "yyyy-MM-dd"))
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    categoryId: row.category_id ?? null,
    note: row.note ?? "",
    amount: row.amount,
    date: new Date(row.date),
    userId: row.user_id,
    createdDate: row.created_at ? new Date(row.created_at) : new Date(),
    updatedDate: row.updated_at ? new Date(row.updated_at) : new Date(),
  }))
}
