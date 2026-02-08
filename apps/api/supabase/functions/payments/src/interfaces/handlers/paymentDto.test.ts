import { assertEquals } from "@std/assert"
import { createPayment } from "../../domain/entities/payment.ts"
import { convertPaymentToDto } from "./paymentDto.ts"

Deno.test("convertPaymentToDto は値を文字列やISO形式に変換する", () => {
  const payment = createPayment({
    id: 1n,
    note: "ランチ",
    amount: 1200,
    date: new Date("2024-01-10T00:00:00.000Z"),
    createdAt: new Date("2024-01-11T00:00:00.000Z"),
    updatedAt: new Date("2024-01-12T00:00:00.000Z"),
    categoryId: 2n,
    userId: 3n,
  })

  const result = convertPaymentToDto(payment)

  assertEquals(result, {
    id: "1",
    note: "ランチ",
    amount: 1200,
    date: "2024-01-10T00:00:00.000Z",
    createdAt: "2024-01-11T00:00:00.000Z",
    updatedAt: "2024-01-12T00:00:00.000Z",
    categoryId: "2",
    userId: "3",
  })
})

Deno.test("convertPaymentToDto はnull値をそのまま返す", () => {
  const payment = createPayment({
    id: 10n,
    note: null,
    amount: 0,
    date: new Date("2024-02-01T00:00:00.000Z"),
    createdAt: null,
    updatedAt: null,
    categoryId: null,
    userId: 11n,
  })

  const result = convertPaymentToDto(payment)

  assertEquals(result, {
    id: "10",
    note: null,
    amount: 0,
    date: "2024-02-01T00:00:00.000Z",
    createdAt: null,
    updatedAt: null,
    categoryId: null,
    userId: "11",
  })
})
