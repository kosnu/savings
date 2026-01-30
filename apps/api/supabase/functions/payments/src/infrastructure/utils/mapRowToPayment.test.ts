import { assertEquals } from "@std/assert"
import { PaymentRecord } from "../../shared/types.ts"
import { mapRowToPayment } from "./mapRowToPayment.ts"

Deno.test("mapRowToPayment maps a PaymentRecord to a Payment entity", () => {
  const record: PaymentRecord = {
    id: BigInt(1),
    note: "Test payment",
    amount: 1000,
    date: "2024-06-01T00:00:00.000Z",
    created_at: "2024-06-01T12:00:00.000Z",
    updated_at: "2024-06-02T12:00:00.000Z",
    category_id: BigInt(2),
    user_id: BigInt(3),
  }

  const payment = mapRowToPayment(record)
  assertEquals(payment.id.value, BigInt(1))
  assertEquals(payment.note.value, "Test payment")
  assertEquals(payment.amount.value, 1000)
  assertEquals(payment.date.value.toISOString(), "2024-06-01T00:00:00.000Z")
  assertEquals(payment.createdAt?.toISOString(), "2024-06-01T12:00:00.000Z")
  assertEquals(payment.updatedAt?.toISOString(), "2024-06-02T12:00:00.000Z")
  assertEquals(payment.categoryId?.value, BigInt(2))
  assertEquals(payment.userId.value, BigInt(3))
})

Deno.test("mapRowToPayment handles null created_at and updated_at", () => {
  const record: PaymentRecord = {
    id: BigInt(1),
    note: null,
    amount: 500,
    date: "2024-06-01T00:00:00.000Z",
    created_at: null,
    updated_at: null,
    category_id: null,
    user_id: BigInt(3),
  }

  const payment = mapRowToPayment(record)
  assertEquals(payment.id.value, BigInt(1))
  assertEquals(payment.note.value, null)
  assertEquals(payment.amount.value, 500)
  assertEquals(payment.date.value.toISOString(), "2024-06-01T00:00:00.000Z")
  assertEquals(payment.createdAt, null)
  assertEquals(payment.updatedAt, null)
  assertEquals(payment.categoryId, null)
  assertEquals(payment.userId.value, BigInt(3))
})

Deno.test("mapRowToPayment handles null category_id", () => {
  const record: PaymentRecord = {
    id: BigInt(1),
    note: "No category",
    amount: 750,
    date: "2024-06-01T00:00:00.000Z",
    created_at: "2024-06-01T12:00:00.000Z",
    updated_at: "2024-06-02T12:00:00.000Z",
    category_id: null,
    user_id: BigInt(3),
  }

  const payment = mapRowToPayment(record)
  assertEquals(payment.id.value, BigInt(1))
  assertEquals(payment.note.value, "No category")
  assertEquals(payment.amount.value, 750)
  assertEquals(payment.date.value.toISOString(), "2024-06-01T00:00:00.000Z")
  assertEquals(payment.createdAt?.toISOString(), "2024-06-01T12:00:00.000Z")
  assertEquals(payment.updatedAt?.toISOString(), "2024-06-02T12:00:00.000Z")
  assertEquals(payment.categoryId, null)
  assertEquals(payment.userId.value, BigInt(3))
})

Deno.test("mapRowToPayment handles null note", () => {
  const record: PaymentRecord = {
    id: BigInt(1),
    note: null,
    amount: 300,
    date: "2024-06-01T00:00:00.000Z",
    created_at: "2024-06-01T12:00:00.000Z",
    updated_at: "2024-06-02T12:00:00.000Z",
    category_id: BigInt(2),
    user_id: BigInt(3),
  }

  const payment = mapRowToPayment(record)
  assertEquals(payment.id.value, BigInt(1))
  assertEquals(payment.note.value, null)
  assertEquals(payment.amount.value, 300)
  assertEquals(payment.date.value.toISOString(), "2024-06-01T00:00:00.000Z")
  assertEquals(payment.createdAt?.toISOString(), "2024-06-01T12:00:00.000Z")
  assertEquals(payment.updatedAt?.toISOString(), "2024-06-02T12:00:00.000Z")
  assertEquals(payment.categoryId?.value, BigInt(2))
  assertEquals(payment.userId.value, BigInt(3))
})
