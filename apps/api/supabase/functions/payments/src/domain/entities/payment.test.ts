import { assertEquals } from "@std/assert"
import { unwrapOk } from "../../shared/unwrapOk.ts"
import { createAmount } from "../valueObjects/amount.ts"
import { createCategoryId } from "../valueObjects/categoryId.ts"
import { createNote } from "../valueObjects/note.ts"
import { createPaymentDate } from "../valueObjects/paymentDate.ts"
import { createPaymentId } from "../valueObjects/paymentId.ts"
import { createUserId } from "../valueObjects/userId.ts"
import { createPayment } from "./payment.ts"

type CreatePaymentParams = Parameters<typeof createPayment>[0]

const createParams = (
  overrides: Partial<CreatePaymentParams> = {},
): CreatePaymentParams => ({
  id: 1,
  note: "Lunch at cafe",
  amount: 1200,
  date: new Date("2025-01-15T12:00:00.000Z"),
  createdAt: new Date("2025-01-15T13:00:00.000Z"),
  updatedAt: new Date("2025-01-15T14:00:00.000Z"),
  categoryId: 10,
  userId: 20,
  ...overrides,
})

Deno.test("createPayment builds a Payment with categoryId", () => {
  const params = createParams()
  const payment = createPayment(params)

  assertEquals(payment, {
    id: unwrapOk(createPaymentId(params.id)),
    note: unwrapOk(createNote(params.note)),
    amount: unwrapOk(createAmount(params.amount)),
    date: unwrapOk(createPaymentDate(params.date)),
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    categoryId: unwrapOk(createCategoryId(params.categoryId!)),
    userId: unwrapOk(createUserId(params.userId)),
  })
})

Deno.test("createPayment allows null categoryId", () => {
  const params = createParams({ categoryId: null })
  const payment = createPayment(params)

  assertEquals(payment, {
    id: unwrapOk(createPaymentId(params.id)),
    note: unwrapOk(createNote(params.note)),
    amount: unwrapOk(createAmount(params.amount)),
    date: unwrapOk(createPaymentDate(params.date)),
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    categoryId: null,
    userId: unwrapOk(createUserId(params.userId)),
  })
})

Deno.test("createPayment allows negative amount", () => {
  const params = createParams({ amount: -1 })
  const payment = createPayment(params)
  assertEquals(payment.amount.value, -1)
})
