import { describe, expect, test } from "vitest"

import type { Payment } from "../../types/payment"
import {
  mapPaymentToFormValues,
  toPaymentWriteInsert,
  toPaymentWriteUpdate,
} from "./paymentFormMappers"

function createPaymentFixture(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 1,
    categoryId: 42,
    note: "lunch",
    amount: 1200,
    date: new Date(2024, 8, 22),
    userId: 10,
    createdDate: new Date(2024, 8, 22, 0, 0, 0),
    updatedDate: new Date(2024, 8, 22, 0, 0, 0),
    ...overrides,
  }
}

describe("mapPaymentToFormValues", () => {
  test("Payment をフォーム値へ変換する", () => {
    const payment = createPaymentFixture()

    expect(mapPaymentToFormValues(payment)).toEqual({
      date: payment.date,
      category: "42",
      note: "lunch",
      amount: 1200,
    })
  })

  test("カテゴリ未設定は空文字に変換する", () => {
    const payment = createPaymentFixture({
      categoryId: null,
      note: "",
      amount: 0,
    })

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
      date: new Date(2024, 8, 22, 12, 34, 56),
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
        date: new Date(2024, 8, 22),
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

describe("toPaymentWriteUpdate", () => {
  test("partial update を write contract 向けに変換する", () => {
    expect(
      toPaymentWriteUpdate({
        date: new Date(2024, 8, 22, 12, 34, 56),
        categoryId: "11",
        note: "dinner",
      }),
    ).toEqual({
      date: "2024-09-22",
      category_id: 11,
      note: "dinner",
    })
  })

  test("空文字は null に正規化する", () => {
    expect(
      toPaymentWriteUpdate({
        categoryId: "",
        note: "",
      }),
    ).toEqual({
      category_id: null,
      note: null,
    })
  })

  test("空 patch は reject する", () => {
    expect(() => toPaymentWriteUpdate({})).toThrow("Payment update patch cannot be empty")
  })
})
