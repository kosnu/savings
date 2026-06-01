import { getSupabaseClient } from "../../../lib/supabase"

export async function removeMonthlyBudget(): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc("remove_current_monthly_budget")

  if (error) {
    throw error
  }
}
