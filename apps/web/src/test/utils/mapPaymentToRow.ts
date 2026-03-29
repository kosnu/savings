import { format } from "date-fns"

import type { Payment, PaymentRow } from "../../types/payment"

export function mapPaymentToRow(payment: Payment): PaymentRow {
  if (payment.id === undefined) {
    throw new Error("Payment id is required to map to PaymentRow")
  }

  return {
    id: payment.id,
    note: payment.note,
    amount: payment.amount,
    date: format(payment.date, "yyyy-MM-dd"),
    created_at: payment.createdDate.toISOString(),
    updated_at: payment.updatedDate.toISOString(),
    category_id: payment.categoryId,
    user_id: payment.userId,
  }
}
