import { getSupabaseClient } from "../../../lib/supabase"
import { type MonthlyBudgetUpdateInput, toMonthlyBudgetUpdate } from "./monthlyBudgetUpdateMappers"

export async function updateMonthlyBudget(value: MonthlyBudgetUpdateInput): Promise<void> {
  const supabase = getSupabaseClient()
  const payload = toMonthlyBudgetUpdate(value)
  const { data, error } = await supabase
    .from("monthly_budgets")
    .update(payload)
    .eq("id", value.monthlyBudgetId)
    .select("id")
    .single()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error("Monthly budget was not updated.")
  }
}
