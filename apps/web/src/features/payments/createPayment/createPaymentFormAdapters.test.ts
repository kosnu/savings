import { describe, expect, test } from "vitest"

import {
  createPaymentDefaultValues,
  mapSubmitFormValuesToPaymentWriteInput,
} from "./createPaymentFormAdapters"

describe("createPaymentDefaultValues", () => {
  test("作成フォームの初期値を返す", () => {
    expect(createPaymentDefaultValues()).toEqual({
      date: expect.any(Date),
      category: "",
      note: "",
      amount: undefined,
    })
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
