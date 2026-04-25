import { describe, expect, test } from "vite-plus/test"

import {
  createMonthlyBudgetDefaultValues,
  mapSubmitFormValuesToMonthlyBudgetWriteInput,
} from "./monthlyBudgetFormAdapters"

describe("createMonthlyBudgetDefaultValues", () => {
  test("月予算作成フォームの初期値を返す", () => {
    expect(createMonthlyBudgetDefaultValues()).toEqual({
      targetMonth: undefined,
      amount: undefined,
    })
  })
})

describe("mapSubmitFormValuesToMonthlyBudgetWriteInput", () => {
  test("submit用フォーム値をwrite inputに変換する", () => {
    const targetMonth = new Date(2026, 2, 1)

    expect(
      mapSubmitFormValuesToMonthlyBudgetWriteInput({
        targetMonth,
        amount: 300000,
      }),
    ).toEqual({
      targetMonth,
      amount: 300000,
    })
  })
})
