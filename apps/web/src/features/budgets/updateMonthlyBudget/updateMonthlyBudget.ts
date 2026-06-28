import { getSupabaseClient } from "../../../lib/supabase"
import {
  type MonthlyBudgetUpdateInput,
  toMonthlyBudgetUpdateArgs,
} from "./monthlyBudgetUpdateMappers"

export async function updateMonthlyBudget(value: MonthlyBudgetUpdateInput): Promise<void> {
  const supabase = getSupabaseClient()
  const args = toMonthlyBudgetUpdateArgs(value)
  const { error } = await supabase.rpc("update_current_monthly_budget", args)

  if (error) {
    throw error
  }
}

export async function updateCurrentMonthlyBudget(amount: number): Promise<void> {
  const currentMonth = new Date()

  await updateMonthlyBudget({ targetMonth: currentMonth, currentMonth, amount })
}
