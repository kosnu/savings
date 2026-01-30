import { unwrapOk } from "../../test/utils/unwrapOk.ts"
import { Amount, createAmount } from "../valueObjects/amount.ts"
import { CategoryId, createCategoryId } from "../valueObjects/categoryId.ts"
import { createNote, Note } from "../valueObjects/note.ts"
import { createPaymentDate, PaymentDate } from "../valueObjects/paymentDate.ts"
import { createPaymentId, PaymentId } from "../valueObjects/paymentId.ts"
import { createUserId, UserId } from "../valueObjects/userId.ts"

export type Payment = {
  id: PaymentId
  note: Note
  amount: Amount
  date: PaymentDate
  createdAt: Date | null
  updatedAt: Date | null

  categoryId: CategoryId | null
  userId: UserId
}

export function createPayment(params: {
  id: bigint
  note: string | null
  amount: number
  date: Date
  createdAt: Date | null
  updatedAt: Date | null

  categoryId: bigint | null
  userId: bigint
}): Payment {
  const id = unwrapOk(createPaymentId(params.id))
  const note = unwrapOk(createNote(params.note))
  const amount = unwrapOk(createAmount(params.amount))
  const date = unwrapOk(createPaymentDate(params.date))
  const categoryId = params.categoryId
    ? unwrapOk(createCategoryId(params.categoryId))
    : null
  const userId = unwrapOk(createUserId(params.userId))

  return {
    id,
    note,
    amount,
    date,
    categoryId,
    userId,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
  }
}
