import { endOfMonth } from "date-fns"
import * as z from "zod"

import { parseDateOnlyStringToLocalDate, toDateOnlyString } from "../../../domain/date"
import { getSupabaseClient } from "../../../lib/supabase"

const spendingRowSchema = z.object({
  id: z.number().int(),
  book_id: z.number().int(),
  date: z.iso.date(),
  amount: z.number().int().nonnegative(),
})

export async function fetchMonthlySpending(
  bookId: number,
  targetMonth: string,
  signal: AbortSignal,
): Promise<{ date: string; amount: number }[]> {
  const start = `${targetMonth}-01`
  const end = toDateOnlyString(endOfMonth(parseDateOnlyStringToLocalDate(start)))
  const supabase = getSupabaseClient()
  const rows: { date: string; amount: number }[] = []
  const ids = new Set<number>()
  const pageSize = 500
  let total: number | null = null

  while (total === null || rows.length < total) {
    const { data, error, count } = await supabase
      .from("payments")
      .select("id,book_id,date,amount", { count: "exact" })
      .eq("book_id", bookId)
      .gte("date", start)
      .lte("date", end)
      .order("id", { ascending: true })
      .range(rows.length, rows.length + pageSize - 1)
      .abortSignal(signal)

    if (error) throw error
    if (count === null || (total !== null && total !== count)) {
      throw new Error("Incomplete monthly spending response")
    }
    total = count
    const page = z.array(spendingRowSchema).parse(data)
    if (page.length === 0 && rows.length < total) {
      throw new Error("Incomplete monthly spending response")
    }
    for (const row of page) {
      if (row.book_id !== bookId || row.date < start || row.date > end || ids.has(row.id)) {
        throw new Error("Invalid monthly spending response")
      }
      ids.add(row.id)
      rows.push({ date: row.date, amount: row.amount })
    }
    if (rows.length > total) throw new Error("Invalid monthly spending response")
  }

  return rows
}
