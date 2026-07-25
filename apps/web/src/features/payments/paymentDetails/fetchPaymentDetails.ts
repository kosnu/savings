import { getSupabaseClient } from "../../../lib/supabase"
import type { PaymentDetails, PaymentId } from "../../../types/payment"
import { toPaymentDetails } from "../paymentResponseMappers"

export async function fetchPaymentDetails(paymentId: PaymentId): Promise<PaymentDetails | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("payments")
    .select(
      `
        id,
        note,
        amount,
        date,
        created_at,
        updated_at,
        book_id,
        category:categories!payments_category_id_fkey (
          id,
          name
        )
      `,
    )
    .eq("id", paymentId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return toPaymentDetails(data)
}
