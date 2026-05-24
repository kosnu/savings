import { describe, expect, test } from "vite-plus/test"
import z from "zod"

import { amountFieldSchema, optionalAmountFieldSchema, toAmountFormValue } from "./amount"

describe("amountFieldSchema", () => {
  test("半角数字文字列を数値化する", () => {
    const result = amountFieldSchema.safeParse("1234")

    expect(result.success).toBe(true)
    expect(result.data).toBe(1234)
  })

  test("数値を受け付ける", () => {
    const result = amountFieldSchema.safeParse(1234)

    expect(result.success).toBe(true)
    expect(result.data).toBe(1234)
  })

  test("0を受け付ける", () => {
    const result = amountFieldSchema.safeParse("0")

    expect(result.success).toBe(true)
    expect(result.data).toBe(0)
  })

  test("空値を拒否する", () => {
    for (const value of ["", " ", undefined]) {
      const result = amountFieldSchema.safeParse(value)

      expect(result.success).toBe(false)
      const error = result.error && z.flattenError(result.error).formErrors
      expect(error).toEqual(["Amount cannot be empty"])
    }
  })

  test("数値として扱わない表記を拒否する", () => {
    for (const value of ["invalid", "1e3", "0x10", "Infinity"]) {
      const result = amountFieldSchema.safeParse(value)

      expect(result.success).toBe(false)
      const error = result.error && z.flattenError(result.error).formErrors
      expect(error).toEqual(["Amount must be a number"])
    }
  })

  test("小数を拒否する", () => {
    const result = amountFieldSchema.safeParse("10.5")

    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).formErrors
    expect(error).toEqual(["Amount must be an integer"])
  })

  test("負数を拒否する", () => {
    const result = amountFieldSchema.safeParse("-1")

    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).formErrors
    expect(error).toEqual(["Amount must be a non-negative integer"])
  })
})

describe("optionalAmountFieldSchema", () => {
  test("空値を未指定として扱う", () => {
    for (const value of ["", " ", undefined]) {
      const result = optionalAmountFieldSchema.safeParse(value)

      expect(result.success).toBe(true)
      expect(result.data).toBeUndefined()
    }
  })

  test("半角数字文字列を数値化する", () => {
    const result = optionalAmountFieldSchema.safeParse("1234")

    expect(result.success).toBe(true)
    expect(result.data).toBe(1234)
  })

  test("数値を受け付ける", () => {
    const result = optionalAmountFieldSchema.safeParse(1234)

    expect(result.success).toBe(true)
    expect(result.data).toBe(1234)
  })
})

describe("toAmountFormValue", () => {
  test("数値をフォーム値へ変換する", () => {
    expect(toAmountFormValue(1234)).toBe("1234")
  })

  test("undefinedは維持する", () => {
    expect(toAmountFormValue(undefined)).toBeUndefined()
  })
})
