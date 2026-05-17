import { format } from "date-fns"
import * as z from "zod"

import { getSupabaseClient } from "../../../lib/supabase"

const categoryTotalsPaymentRowSchema = z.object({
  amount: z.number(),
  date: z.string(),
})

const categoryTotalsRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  payments: z.array(categoryTotalsPaymentRowSchema),
})

type CategoryTotalsRow = z.infer<typeof categoryTotalsRowSchema>

const categoryTotalsColumns = `
  id,
  name,
  payments:payments!payments_category_id_fkey (
    amount,
    date
  )
`

export async function fetchCategoryTotals([startDate, endDate]: [
  Date | null,
  Date | null,
]): Promise<Record<string, number>> {
  const supabase = getSupabaseClient()
  let query = supabase.from("categories").select(categoryTotalsColumns).order("id", {
    ascending: true,
  })

  if (startDate) {
    query = query.gte("payments.date", format(startDate, "yyyy-MM-dd"))
  }
  if (endDate) {
    query = query.lte("payments.date", format(endDate, "yyyy-MM-dd"))
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []).reduce<Record<string, number>>((totals, value) => {
    const row = normalizeCategoryTotalsRow(value)
    totals[row.name] = row.payments.reduce((sum, payment) => sum + payment.amount, 0)

    return totals
  }, {})
}

function normalizeCategoryTotalsRow(value: unknown): CategoryTotalsRow {
  const result = categoryTotalsRowSchema.safeParse(value)

  if (!result.success) {
    throw new Error("Invalid category totals response")
  }

  return result.data
}
