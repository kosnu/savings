import { getSupabaseClient } from "../../lib/supabase"

export async function fetchTotalExpenditures(month: string): Promise<number | null> {
  if (!month) {
    return null
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc("get_monthly_total_amount", {
    p_month: month,
  })

  if (error) {
    throw error
  }

  return data ?? 0
}
