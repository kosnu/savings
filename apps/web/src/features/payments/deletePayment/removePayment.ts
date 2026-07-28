import { getSupabaseClient } from "../../../lib/supabase"

export async function removePayment(bookId: number, paymentId: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId)
    .eq("book_id", bookId)
    .select("id")
    .maybeSingle()

  if (error) {
    throw error
  }

  if (data?.id !== paymentId) {
    throw new Error("Payment not found")
  }
}
