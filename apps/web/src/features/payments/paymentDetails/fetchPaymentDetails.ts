import { getSupabaseClient } from "../../../lib/supabase"
import type { PaymentDetails, PaymentId } from "../../../types/payment"
import { toPaymentDetails } from "../paymentResponseMappers"

export async function fetchPaymentDetails(
  bookId: number,
  paymentId: PaymentId,
): Promise<PaymentDetails | null> {
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
    .eq("book_id", bookId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  const payment = toPaymentDetails(data)
  if (payment.bookId !== bookId) {
    throw new Error("Invalid payment details response")
  }

  return payment
}
