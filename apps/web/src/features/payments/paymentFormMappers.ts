import { format } from "date-fns"

import type { TablesInsert, TablesUpdate } from "../../types/database.types"
import type { Payment } from "../../types/payment"
import type { PaymentFormValues } from "./paymentFormSchema"

type PaymentInsert = Omit<TablesInsert<"payments">, "user_id">
type PaymentUpdate = Omit<TablesUpdate<"payments">, "user_id" | "id" | "created_at" | "updated_at">

export interface PaymentWriteInput {
  categoryId?: string
  date: Date
  note?: string
  amount: number
}

export interface PaymentUpdatePatch {
  categoryId?: string
  date?: Date
  note?: string
  amount?: number
}

export function mapPaymentToFormValues(payment: Payment): PaymentFormValues {
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

export function toPaymentWriteUpdate(patch: PaymentUpdatePatch): PaymentUpdate {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined)

  if (entries.length === 0) {
    throw new Error("Payment update patch cannot be empty")
  }

  const updatePayload: PaymentUpdate = {}

  if (patch.amount !== undefined) {
    updatePayload.amount = patch.amount
  }
  if (patch.date !== undefined) {
    updatePayload.date = format(patch.date, "yyyy-MM-dd")
  }
  if (patch.note !== undefined) {
    updatePayload.note = patch.note || null
  }
  if (patch.categoryId !== undefined) {
    updatePayload.category_id = toCategoryId(patch.categoryId)
  }

  return updatePayload
}

function toCategoryId(categoryId?: string): number | null {
  if (!categoryId) return null
  const parsed = Number(categoryId)
  return Number.isNaN(parsed) ? null : parsed
}
