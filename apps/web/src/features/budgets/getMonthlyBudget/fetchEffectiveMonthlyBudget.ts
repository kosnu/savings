import { getSupabaseClient } from "../../../lib/supabase"
import { normalizeMonthlyBudgetRow, toMonthlyBudget } from "../monthlyBudgetMappers"
import type { MonthlyBudget } from "../types"
import { toMonthEndIsoDate } from "../utils/month"

export async function fetchEffectiveMonthlyBudget(targetDate: Date): Promise<MonthlyBudget | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("monthly_budgets")
    .select(
      "id, book_id, amount, effective_from, effective_year, effective_month, created_at, updated_at",
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
