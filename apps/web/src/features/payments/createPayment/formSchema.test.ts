import { describe, expect, test } from "vitest"
import z from "zod"
import { formSchema, submitFormSchema } from "./formSchema"

describe("formSchema", () => {
  const data = {
    category: "hoge",
    date: new Date(),
    note: "test",
    amount: 10,
  }

  test("Valid data test", () => {
    {
      const result = formSchema.safeParse(data)
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(10)
      expect(result.data?.date).toBeInstanceOf(Date)
    }
    {
      const result = formSchema.safeParse({ ...data, amount: 0 })
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(0)
    }
    {
      const result = formSchema.safeParse({ ...data, amount: undefined })
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBeUndefined()
    }
  })

  test("should fail when category is empty", () => {
    const result = formSchema.safeParse({ ...data, category: "" })
    expect(result.success).toBe(false)

    const error =
      result.error && z.flattenError(result.error).fieldErrors.category
    expect(error).toEqual(["Category can not be empty"])
  })

  test("should fail when date is iso", () => {
    const result = formSchema.safeParse({
      ...data,
      date: "2024-01-01T00:00:00+09:00",
    })
    expect(result.success).toBe(false)

    const error = result.error && z.flattenError(result.error).fieldErrors.date
    expect(error).toEqual(["Date is invalid"])
  })

  test("should fail when date is invalid", () => {
    {
      const result = formSchema.safeParse({ ...data, date: "hoge" })
      expect(result.success).toBe(false)

      const error =
        result.error && z.flattenError(result.error).fieldErrors.date
      expect(error).toEqual(["Date is invalid"])
    }
  })

  test("should fail when date is empty", () => {
    const result = formSchema.safeParse({ ...data, date: "" })
    expect(result.success).toBe(false)

    const error = result.error && z.flattenError(result.error).fieldErrors.date
    expect(error).toEqual(["Date can not be empty"])
  })

  test("should fail when amount is invalid", () => {
    const result = formSchema.safeParse({ ...data, amount: "invalid" })
    expect(result.success).toBe(false)
    const error =
      result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be a number"])
  })

  test("should fail when amount is empty", () => {
    const result = formSchema.safeParse({ ...data, amount: "" })
    expect(result.success).toBe(false)
    const error =
      result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount can not be empty"])
  })

  test("should fail when amount is negative", () => {
    const result = formSchema.safeParse({ ...data, amount: -1 })
    expect(result.success).toBe(false)
    const error =
      result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be a non-negative integer"])
  })

  test("should fail when amount is decimal", () => {
    const result = formSchema.safeParse({ ...data, amount: 10.5 })
    expect(result.success).toBe(false)
    const error =
      result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be an integer"])
  })
})

describe("submitFormSchema", () => {
  const data = {
    category: "hoge",
    date: new Date(),
    note: "test",
    amount: 10,
  }

  test("Valid data test", () => {
    {
      const result = submitFormSchema.safeParse(data)
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(10)
      expect(result.data?.date).toBeInstanceOf(Date)
    }
    {
      const result = submitFormSchema.safeParse({ ...data, amount: 0 })
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(0)
    }
  })

  test("should fail when amount is empty", () => {
    const result = submitFormSchema.safeParse({ ...data, amount: undefined })
    expect(result.success).toBe(false)
    const error =
      result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount can not be empty"])
  })

  test("should fail when amount is empty string", () => {
    const result = submitFormSchema.safeParse({ ...data, amount: "" })
    expect(result.success).toBe(false)
    const error =
      result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount can not be empty"])
  })

  test("should fail when amount is invalid", () => {
    const result = submitFormSchema.safeParse({ ...data, amount: "invalid" })
    expect(result.success).toBe(false)
    const error =
      result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be a number"])
  })

  test("should fail when amount is negative", () => {
    const result = submitFormSchema.safeParse({ ...data, amount: -1 })
    expect(result.success).toBe(false)
    const error =
      result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be a non-negative integer"])
  })

  test("should fail when amount is decimal", () => {
    const result = submitFormSchema.safeParse({ ...data, amount: 10.5 })
    expect(result.success).toBe(false)
    const error =
      result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be an integer"])
  })
})
