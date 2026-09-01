import { getSupabaseClient } from "../../../lib/supabase"

export async function removeMonthlyBudget(monthlyBudgetId: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc("remove_current_monthly_budget", {
    p_monthly_budget_id: monthlyBudgetId,
  })

  if (error) {
    throw error
  }
}
