import { describe, expect, test } from "vite-plus/test"

import type { Payment } from "../../types/payment"
import {
  mapPaymentToFormValues,
  toPaymentWriteInsert,
  toPaymentWriteUpdate,
} from "./paymentFormMappers"
import { PAYMENT_NOTE_MAX_LENGTH } from "./paymentFormSchema"

function createPaymentFixture(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 1,
    categoryId: 42,
    note: "lunch",
    amount: 1200,
    date: new Date(2024, 8, 22),
    bookId: 1,
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
      amount: "1200",
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
      amount: "0",
    })
  })

  test("許容範囲外の既存日付もフォーム値への読み取りでは維持する", () => {
    const payment = createPaymentFixture({ date: new Date(2021, 11, 31) })

    expect(mapPaymentToFormValues(payment).date).toBe(payment.date)
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

    const row = toPaymentWriteInsert(value)

    expect(row).toEqual({
      date: "2024-09-22",
      category_id: 11,
      note: "dinner",
      amount: 1080,
    })
    expect(row).not.toHaveProperty("user_id")
    expect(row).not.toHaveProperty("book_id")
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

  test("30文字を超える note は reject する", () => {
    expect(() =>
      toPaymentWriteInsert({
        date: new Date(2024, 8, 22),
        categoryId: "",
        note: "a".repeat(PAYMENT_NOTE_MAX_LENGTH + 1),
        amount: 0,
      }),
    ).toThrow(`Note must be ${PAYMENT_NOTE_MAX_LENGTH} characters or less`)
  })

  test.each([
    { date: new Date(2022, 0, 1), dateOnly: "2022-01-01" },
    { date: new Date(2032, 11, 31, 23, 59, 59), dateOnly: "2032-12-31" },
  ])("許容範囲の端点 $dateOnly を作成できる", ({ date, dateOnly }) => {
    expect(toPaymentWriteInsert({ date, amount: 0 }).date).toBe(dateOnly)
  })

  test.each([new Date(2021, 11, 31), new Date(2033, 0, 1), new Date(NaN)])(
    "範囲外または不正な日付 %s の作成は拒否する",
    (date) => {
      expect(() => toPaymentWriteInsert({ date, amount: 0 })).toThrow()
    },
  )
})

describe("toPaymentWriteUpdate", () => {
  test("partial update を write contract 向けに変換する", () => {
    const payload = toPaymentWriteUpdate({
      date: new Date(2024, 8, 22, 12, 34, 56),
      categoryId: "11",
      note: "dinner",
    })

    expect(payload).toEqual({
      date: "2024-09-22",
      category_id: 11,
      note: "dinner",
    })
    expect(payload).not.toHaveProperty("user_id")
    expect(payload).not.toHaveProperty("book_id")
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

  test("30文字を超える note は reject する", () => {
    expect(() =>
      toPaymentWriteUpdate({
        note: "a".repeat(PAYMENT_NOTE_MAX_LENGTH + 1),
      }),
    ).toThrow(`Note must be ${PAYMENT_NOTE_MAX_LENGTH} characters or less`)
  })

  test.each([
    { date: new Date(2022, 0, 1), dateOnly: "2022-01-01" },
    { date: new Date(2032, 11, 31, 23, 59, 59), dateOnly: "2032-12-31" },
  ])("許容範囲の端点 $dateOnly に更新できる", ({ date, dateOnly }) => {
    expect(toPaymentWriteUpdate({ date }).date).toBe(dateOnly)
  })

  test.each([new Date(2021, 11, 31), new Date(2033, 0, 1), new Date(NaN)])(
    "範囲外または不正な日付 %s への更新は拒否する",
    (date) => {
      expect(() => toPaymentWriteUpdate({ date })).toThrow()
    },
  )

  test("日付を含まない更新は既存日付の範囲を検証せずに変換する", () => {
    expect(toPaymentWriteUpdate({ amount: 500, note: "修正" })).toEqual({
      amount: 500,
      note: "修正",
    })
  })
})
