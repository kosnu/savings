import { toDateOnlyString } from "../../domain/date"
import type { Payment, PaymentRow } from "../../types/payment"

export function mapPaymentToRow(payment: Payment): PaymentRow {
  if (payment.id === undefined) {
    throw new Error("Payment id is required to map to PaymentRow")
  }

  return {
    id: payment.id,
    note: payment.note,
    amount: payment.amount,
    date: toDateOnlyString(payment.date),
    created_at: payment.createdDate.toISOString(),
    updated_at: payment.updatedDate.toISOString(),
    book_id: payment.bookId,
    category_id: payment.categoryId,
  }
}
