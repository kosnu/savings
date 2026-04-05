import { getSupabaseClient } from "../../../lib/supabase"
import type { PaymentId } from "../../../types/payment"
import { type PaymentUpdatePatch, toPaymentWriteUpdate } from "../paymentFormMappers"

export async function updatePayment(
  paymentId: PaymentId,
  patch: PaymentUpdatePatch,
): Promise<void> {
  const supabase = getSupabaseClient()
  const payload = toPaymentWriteUpdate(patch)
  const { error } = await supabase.from("payments").update(payload).eq("id", paymentId)

  if (error) {
    throw error
  }
}
