import { format } from "date-fns"

import type { TablesInsert } from "../../types/database.types"
import type { Payment } from "../../types/payment"
import type { FormSchema } from "./createPayment/formSchema"

type PaymentInsert = Omit<TablesInsert<"payments">, "user_id">

export interface PaymentWriteInput {
  categoryId?: string
  date: Date
  note?: string
  amount: number
}

export function mapPaymentToFormValues(payment: Payment): FormSchema {
  return {
    date: payment.date,
    category: payment.categoryId === null ? "" : String(payment.categoryId),
    note: payment.note,
    amount: payment.amount,
  }
}

export function toPaymentWriteInsert(value: PaymentWriteInput): PaymentInsert {
  return {
    amount: value.amount,
    date: format(value.date, "yyyy-MM-dd"),
    note: value.note || null,
    category_id: toCategoryId(value.categoryId),
  }
}

function toCategoryId(categoryId?: string): number | null {
  if (!categoryId) return null
  const parsed = Number(categoryId)
  return Number.isNaN(parsed) ? null : parsed
}
