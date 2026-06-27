import { toDateOnlyString, toMonthStartDate } from "../../../domain/date"
import { getSupabaseClient } from "../../../lib/supabase"

export interface MonthlyBudgetRemoveInput {
  targetMonth: Date
}

export async function removeMonthlyBudget(value: MonthlyBudgetRemoveInput): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc("remove_current_monthly_budget", {
    p_target_month: toDateOnlyString(toMonthStartDate(value.targetMonth)),
  })

  if (error) {
    throw error
  }
}
