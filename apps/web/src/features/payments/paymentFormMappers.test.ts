import { describe, expect, test } from "vitest"

import type { Payment } from "../../types/payment"
import { mapPaymentToFormValues, toPaymentWriteInsert } from "./paymentFormMappers"

describe("mapPaymentToFormValues", () => {
  test("Payment をフォーム値へ変換する", () => {
    const payment: Payment = {
      id: 1,
      categoryId: 42,
      note: "lunch",
      amount: 1200,
      date: new Date("2024-09-22"),
      userId: 10,
      createdDate: new Date("2024-09-22T00:00:00Z"),
      updatedDate: new Date("2024-09-22T00:00:00Z"),
    }

    expect(mapPaymentToFormValues(payment)).toEqual({
      date: payment.date,
      category: "42",
      note: "lunch",
      amount: 1200,
    })
  })

  test("カテゴリ未設定は空文字に変換する", () => {
    const payment: Payment = {
      id: 1,
      categoryId: null,
      note: "",
      amount: 0,
      date: new Date("2024-09-22"),
      userId: 10,
      createdDate: new Date("2024-09-22T00:00:00Z"),
      updatedDate: new Date("2024-09-22T00:00:00Z"),
    }

    expect(mapPaymentToFormValues(payment)).toEqual({
      date: payment.date,
      category: "",
      note: "",
      amount: 0,
    })
  })
})

describe("toPaymentWriteInsert", () => {
  test("write contract 向けに値変換する", () => {
    const value = {
      date: new Date("2024-09-22T12:34:56+09:00"),
      categoryId: "11",
      note: "dinner",
      amount: 1080,
    }

    expect(toPaymentWriteInsert(value)).toEqual({
      date: "2024-09-22",
      category_id: 11,
      note: "dinner",
      amount: 1080,
    })
  })

  test("空文字は null に正規化する", () => {
    expect(
      toPaymentWriteInsert({
        date: new Date("2024-09-22"),
        categoryId: "",
        note: "",
        amount: 0,
      }),
    ).toEqual({
      date: "2024-09-22",
      category_id: null,
      note: null,
      amount: 0,
    })
  })
})
