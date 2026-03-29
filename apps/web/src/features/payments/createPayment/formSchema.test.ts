import { describe, expect, test } from "vitest"
import z from "zod"

import { paymentFormSchema, paymentFormSubmitSchema } from "../paymentFormSchema"

describe("paymentFormSchema", () => {
  const data = {
    category: "hoge",
    date: new Date(),
    note: "test",
    amount: 10,
  }

  test("Valid data test", () => {
    {
      const result = paymentFormSchema.safeParse(data)
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(10)
      expect(result.data?.date).toBeInstanceOf(Date)
    }
    {
      const result = paymentFormSchema.safeParse({ ...data, amount: 0 })
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(0)
    }
    {
      const result = paymentFormSchema.safeParse({ ...data, amount: undefined })
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBeUndefined()
    }
  })

  test("should allow empty category", () => {
    const result = paymentFormSchema.safeParse({ ...data, category: "" })
    expect(result.success).toBe(true)
    expect(result.data?.category).toBe("")
  })

  test("should allow empty note", () => {
    const result = paymentFormSchema.safeParse({ ...data, note: "" })
    expect(result.success).toBe(true)
    expect(result.data?.note).toBe("")
  })

  test("should fail when date is iso", () => {
    const result = paymentFormSchema.safeParse({
      ...data,
      date: "2024-01-01T00:00:00+09:00",
    })
    expect(result.success).toBe(false)

    const error = result.error && z.flattenError(result.error).fieldErrors.date
    expect(error).toEqual(["Date is invalid"])
  })

  test("should fail when date is invalid", () => {
    {
      const result = paymentFormSchema.safeParse({ ...data, date: "hoge" })
      expect(result.success).toBe(false)

      const error = result.error && z.flattenError(result.error).fieldErrors.date
      expect(error).toEqual(["Date is invalid"])
    }
  })

  test("should fail when date is empty", () => {
    const result = paymentFormSchema.safeParse({ ...data, date: "" })
    expect(result.success).toBe(false)

    const error = result.error && z.flattenError(result.error).fieldErrors.date
    expect(error).toEqual(["Date cannot be empty"])
  })

  test("should fail when amount is invalid", () => {
    const result = paymentFormSchema.safeParse({ ...data, amount: "invalid" })
    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be a number"])
  })

  test("should fail when amount is empty", () => {
    const result = paymentFormSchema.safeParse({ ...data, amount: "" })
    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount cannot be empty"])
  })

  test("should fail when amount is negative", () => {
    const result = paymentFormSchema.safeParse({ ...data, amount: -1 })
    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be a non-negative integer"])
  })

  test("should fail when amount is decimal", () => {
    const result = paymentFormSchema.safeParse({ ...data, amount: 10.5 })
    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be an integer"])
  })
})

describe("paymentFormSubmitSchema", () => {
  const data = {
    category: "hoge",
    date: new Date(),
    note: "test",
    amount: 10,
  }

  test("Valid data test", () => {
    {
      const result = paymentFormSubmitSchema.safeParse(data)
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(10)
      expect(result.data?.date).toBeInstanceOf(Date)
    }
    {
      const result = paymentFormSubmitSchema.safeParse({ ...data, amount: 0 })
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(0)
    }
    {
      const result = paymentFormSubmitSchema.safeParse({
        ...data,
        category: "",
        note: "",
      })
      expect(result.success).toBe(true)
      expect(result.data?.category).toBe("")
      expect(result.data?.note).toBe("")
    }
  })

  test("should fail when amount is empty", () => {
    const result = paymentFormSubmitSchema.safeParse({ ...data, amount: undefined })
    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount cannot be empty"])
  })

  test("should fail when amount is empty string", () => {
    const result = paymentFormSubmitSchema.safeParse({ ...data, amount: "" })
    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount cannot be empty"])
  })

  test("should fail when amount is invalid", () => {
    const result = paymentFormSubmitSchema.safeParse({ ...data, amount: "invalid" })
    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be a number"])
  })

  test("should fail when amount is negative", () => {
    const result = paymentFormSubmitSchema.safeParse({ ...data, amount: -1 })
    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be a non-negative integer"])
  })

  test("should fail when amount is decimal", () => {
    const result = paymentFormSubmitSchema.safeParse({ ...data, amount: 10.5 })
    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be an integer"])
  })
})
