import * as z from "zod"

import { getSupabaseClient } from "../../../lib/supabase"
import { normalizeMonthlyBudgetRows, toMonthlyBudget } from "../monthlyBudgetMappers"
import type { MonthlyBudget } from "../types"

const monthlyBudgetColumns =
  "id, book_id, amount, effective_from, effective_year, effective_month, user_id, created_at, updated_at"
const monthlyBudgetLimitSchema = z.number().int().positive()

export async function fetchMonthlyBudgets(limit: number): Promise<MonthlyBudget[]> {
  assertPositiveInteger(limit)

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("monthly_budgets")
    .select(monthlyBudgetColumns)
    .order("effective_from", { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return normalizeMonthlyBudgetRows(data).map(toMonthlyBudget)
}

function assertPositiveInteger(value: number): void {
  const result = monthlyBudgetLimitSchema.safeParse(value)

  if (!result.success) {
    throw new RangeError("Monthly budget limit must be a positive integer")
  }
}
