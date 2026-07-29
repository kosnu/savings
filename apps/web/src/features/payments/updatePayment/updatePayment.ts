import { getSupabaseClient } from "../../../lib/supabase"
import type { PaymentId } from "../../../types/payment"
import { type PaymentUpdatePatch, toPaymentWriteUpdate } from "../paymentFormMappers"

export async function updatePayment(
  bookId: number,
  paymentId: PaymentId,
  patch: PaymentUpdatePatch,
): Promise<void> {
  const supabase = getSupabaseClient()
  const payload = toPaymentWriteUpdate(patch)
  const { data, error } = await supabase
    .from("payments")
    .update(payload)
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
