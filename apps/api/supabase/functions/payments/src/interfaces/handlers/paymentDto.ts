import { Payment } from "../../domain/entities/payment.ts"

export interface PaymentDto {
  id: string
  note: string | null
  amount: number
  date: string
  createdAt: string | null
  updatedAt: string | null
  categoryId: string | null
  userId: string
}

export function convertPaymentToDto(payment: Payment): PaymentDto {
  return {
    id: payment.id.value.toString(),
    note: payment.note.value,
    amount: payment.amount.value,
    date: payment.date.value.toISOString(),
    createdAt: payment.createdAt ? payment.createdAt.toISOString() : null,
    updatedAt: payment.updatedAt ? payment.updatedAt.toISOString() : null,
    categoryId: payment.categoryId ? payment.categoryId.value.toString() : null,
    userId: payment.userId.value.toString(),
  }
}
