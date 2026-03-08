import { getSupabaseClient } from "../../../lib/supabase"

export async function removePayment(paymentId: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("payments").delete().eq("id", paymentId)

  if (error) {
    throw error
  }
}
