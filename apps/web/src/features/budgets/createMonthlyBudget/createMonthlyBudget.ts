import { getSupabaseClient } from "../../../lib/supabase"
import { type MonthlyBudgetWriteInput, toMonthlyBudgetInsert } from "./monthlyBudgetFormMappers"

export async function createMonthlyBudget(value: MonthlyBudgetWriteInput): Promise<void> {
  const supabase = getSupabaseClient()
  const row = toMonthlyBudgetInsert(value)
  const { error } = await supabase.from("monthly_budgets").insert(row)

  if (error) {
    throw error
  }
}
