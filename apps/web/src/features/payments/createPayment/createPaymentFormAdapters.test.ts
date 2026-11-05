import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import {
  createPaymentDefaultValues,
  mapSubmitFormValuesToPaymentWriteInput,
} from "./createPaymentFormAdapters"

describe("createPaymentDefaultValues", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 22))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("作成フォームの初期値を返す", () => {
    expect(createPaymentDefaultValues()).toEqual({
      date: expect.any(Date),
      category: "",
      note: "",
      amount: undefined,
    })
  })

  test.each([
    { now: new Date(2021, 11, 31), expected: new Date(2022, 0, 1) },
    { now: new Date(2033, 0, 1), expected: new Date(2032, 11, 31) },
    { now: new Date(2022, 0, 1), expected: new Date(2022, 0, 1) },
    { now: new Date(2032, 11, 31, 23, 59), expected: new Date(2032, 11, 31, 23, 59) },
    { now: new Date(2026, 9, 22, 12, 34), expected: new Date(2026, 9, 22, 12, 34) },
  ])("現在時刻 $now から許容範囲内の初期日付を作る", ({ now, expected }) => {
    vi.setSystemTime(now)

    expect(createPaymentDefaultValues().date).toEqual(expected)
  })
})

describe("mapSubmitFormValuesToPaymentWriteInput", () => {
  test("submit 用フォーム値を write input に変換する", () => {
    const value = {
      date: new Date("2024-09-22"),
      category: "11",
      note: "dinner",
      amount: 1080,
    }

    expect(mapSubmitFormValuesToPaymentWriteInput(value)).toEqual({
      date: value.date,
      categoryId: "11",
      note: "dinner",
      amount: 1080,
    })
  })
})
