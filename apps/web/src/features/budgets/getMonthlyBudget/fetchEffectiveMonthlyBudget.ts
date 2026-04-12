import * as z from "zod"

import { getSupabaseClient } from "../../../lib/supabase"
import type { MonthlyBudget, MonthlyBudgetRow } from "../types"
import { parseIsoDateOnlyToLocalDate, toMonthEndIsoDate } from "../utils/month"

const monthlyBudgetRowSchema = z.object({
  id: z.number(),
  amount: z.number(),
  effective_from: z.string(),
  effective_year: z.number(),
  effective_month: z.number(),
  user_id: z.number(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
})

type NormalizedMonthlyBudgetRow = z.infer<typeof monthlyBudgetRowSchema>

export async function fetchEffectiveMonthlyBudget(targetDate: Date): Promise<MonthlyBudget | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("monthly_budgets")
    .select(
      "id, amount, effective_from, effective_year, effective_month, user_id, created_at, updated_at",
    )
    .lte("effective_from", toMonthEndIsoDate(targetDate))
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return toMonthlyBudget(normalizeMonthlyBudgetRow(data))
}

function normalizeMonthlyBudgetRow(value: unknown): NormalizedMonthlyBudgetRow {
  const result = monthlyBudgetRowSchema.safeParse(value)

  if (!result.success) {
    throw new Error("Invalid monthly budget response")
  }

  return result.data
}

function toMonthlyBudget(row: MonthlyBudgetRow): MonthlyBudget {
  return {
    id: row.id,
    amount: row.amount,
    effectiveFrom: parseIsoDateOnlyToLocalDate(row.effective_from),
    effectiveYear: row.effective_year,
    effectiveMonth: row.effective_month,
    userId: row.user_id,
    createdDate: row.created_at ? new Date(row.created_at) : new Date(),
    updatedDate: row.updated_at ? new Date(row.updated_at) : new Date(),
  }
}
