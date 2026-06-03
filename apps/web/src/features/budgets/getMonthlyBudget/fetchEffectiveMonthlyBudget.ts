import { toDateOnlyString } from "../../../domain/date"
import { getSupabaseClient } from "../../../lib/supabase"
import {
  normalizeEffectiveMonthlyBudgetResponse,
  toMonthlyBudgetState,
} from "../monthlyBudgetMappers"
import type { MonthlyBudgetState } from "../types"

export async function fetchEffectiveMonthlyBudget(targetDate: Date): Promise<MonthlyBudgetState> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc("get_effective_monthly_budget", {
    p_target_month: toDateOnlyString(targetDate),
  })

  if (error) {
    throw error
  }

  return toMonthlyBudgetState(normalizeEffectiveMonthlyBudgetResponse(data))
}
