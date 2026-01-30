import { createPayment, Payment } from "../../domain/entities/payment.ts"
import { PaymentRecord } from "../../shared/types.ts"

export function mapRowToPayment(record: PaymentRecord): Payment {
  const payment = createPayment({
    ...record,
    date: new Date(record.date),
    createdAt: toDate(record.created_at),
    updatedAt: toDate(record.updated_at),
    categoryId: record.category_id,
    userId: record.user_id,
  })

  return payment
}

function toDate(value: string | null): Date | null {
  if (value === null) {
    return null
  }
  return new Date(value)
}
