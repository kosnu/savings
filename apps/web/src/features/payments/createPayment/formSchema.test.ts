import { describe, expect, test } from "vitest"
import z from "zod"
import { formShema } from "./formSchema"

describe("formSchema", () => {
  const data = {
    category: "hoge",
    date: "2024-01-01T00:00:00.000Z",
    note: "test",
    amount: "10",
  }

  test("Valid data test", () => {
    {
      const result = formShema.safeParse(data)
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(10)
      expect(result.data?.date).toBeInstanceOf(Date)
    }
    {
      const result = formShema.safeParse({ ...data, amount: "0" })
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(0)
    }
    {
      const result = formShema.safeParse({
        ...data,
        date: "2024-01-01T00:00:00+09:00",
      })
      expect(result.success).toBe(true)
      expect(result.data?.date).toBeInstanceOf(Date)
    }
  })

  test("should fail when category is empty", () => {
    const result = formShema.safeParse({ ...data, category: "" })
    expect(result.success).toBe(false)

    const error =
      result.error && z.flattenError(result.error).fieldErrors.category
    expect(error).toEqual(["Category can not be empty"])
  })

  test("should fail when date is invalid", () => {
    {
      const result = formShema.safeParse({ ...data, date: "hoge" })
      expect(result.success).toBe(false)

      const error =
        result.error && z.flattenError(result.error).fieldErrors.date
      expect(error).toEqual(["Date can not be empty"]) // TODO: 値が無効な形式なのに"Date can not be empty" になるのはおかしいので修正する
    }
  })

  test("should fail when amount is invalid", () => {
    const result = formShema.safeParse({ ...data, amount: "invalid" })
    expect(result.success).toBe(false)
    const error =
      result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be a number"])
  })

  test("should fail when amount is empty", () => {
    const result = formShema.safeParse({ ...data, amount: "" })
    expect(result.success).toBe(false)
    const error =
      result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount can not be empty"])
  })

  test("should fail when amount is negative", () => {
    const result = formShema.safeParse({ ...data, amount: "-1" })
    expect(result.success).toBe(false)
    const error =
      result.error && z.flattenError(result.error).fieldErrors.amount
    expect(error).toEqual(["Amount must be a non-negative integer"])
  })
})
