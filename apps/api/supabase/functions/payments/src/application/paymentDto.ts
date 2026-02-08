import { Payment } from "../domain/entities/payment.ts"

export interface PaymentDto {
  id: string
  note: string | null
  amount: number
  date: string
  categoryId: string | null
  userId: string
  createdAt: string | null
  updatedAt: string | null
}

export function convertPaymentToDto(payment: Payment): PaymentDto {
  return {
    id: payment.id.value.toString(),
    note: payment.note.value,
    amount: payment.amount.value,
    date: payment.date.value.toISOString(),
    categoryId: payment.categoryId?.value.toString() ?? null,
    userId: payment.userId.value.toString(),
    createdAt: payment.createdAt?.toISOString() ?? null,
    updatedAt: payment.updatedAt?.toISOString() ?? null,
  }
}
