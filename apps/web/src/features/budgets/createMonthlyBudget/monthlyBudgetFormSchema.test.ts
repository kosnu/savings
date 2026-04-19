import { describe, expect, test } from "vitest"
import z from "zod"

import { monthlyBudgetFormSchema, monthlyBudgetFormSubmitSchema } from "./monthlyBudgetFormSchema"

describe("monthlyBudgetFormSchema", () => {
  const data = {
    targetMonth: new Date(2026, 2, 1),
    amount: 300000,
  }

  test("有効なフォーム値を受け付ける", () => {
    const result = monthlyBudgetFormSchema.safeParse(data)

    expect(result.success).toBe(true)
    expect(result.data?.targetMonth).toBeInstanceOf(Date)
    expect(result.data?.amount).toBe(300000)
  })

  test("入力前の空値を受け付ける", () => {
    const result = monthlyBudgetFormSchema.safeParse({
      targetMonth: undefined,
      amount: undefined,
    })

    expect(result.success).toBe(true)
    expect(result.data?.targetMonth).toBeUndefined()
    expect(result.data?.amount).toBeUndefined()
  })

  test("月が不正な場合は英語のエラーにする", () => {
    const result = monthlyBudgetFormSchema.safeParse({ ...data, targetMonth: "" })

    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.targetMonth
    expect(error).toEqual(["Month cannot be empty"])
  })

  test("金額が不正な場合は英語のエラーにする", () => {
    const result = monthlyBudgetFormSchema.safeParse({ ...data, amount: "invalid" })

    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be a number"])
  })

  test("金額が小数の場合は英語のエラーにする", () => {
    const result = monthlyBudgetFormSchema.safeParse({ ...data, amount: 10.5 })

    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be an integer"])
  })

  test("金額が負数の場合は英語のエラーにする", () => {
    const result = monthlyBudgetFormSchema.safeParse({ ...data, amount: -1 })

    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be a non-negative integer"])
  })
})

describe("monthlyBudgetFormSubmitSchema", () => {
  test("submit時は月と金額を必須にする", () => {
    const result = monthlyBudgetFormSubmitSchema.safeParse({
      targetMonth: undefined,
      amount: undefined,
    })

    expect(result.success).toBe(false)
    if (result.success) {
      throw new Error("Expected monthly budget submit values to be invalid")
    }

    const error = z.flattenError(result.error).fieldErrors
    expect(error.targetMonth).toEqual(["Month cannot be empty"])
    expect(error.amount).toEqual(["Amount cannot be empty"])
  })
})
