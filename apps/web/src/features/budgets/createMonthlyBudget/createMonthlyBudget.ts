import { getSupabaseClient } from "../../../lib/supabase"
import { type MonthlyBudgetWriteInput, toMonthlyBudgetCreateArgs } from "./monthlyBudgetFormMappers"

export async function createMonthlyBudget(value: MonthlyBudgetWriteInput): Promise<void> {
  const supabase = getSupabaseClient()
  const args = toMonthlyBudgetCreateArgs(value)
  const { error } = await supabase.rpc("create_monthly_budget", args)

  if (error) {
    throw error
  }
}
