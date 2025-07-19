import { describe, expect, test } from "vitest"
import { findZodError } from "../../utils/findZodError"
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
      const result = formShema.safeParse({ ...data, amount: "-1,000" })
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(-1000)
    }
  })

  test("should fail when category is empty", () => {
    const result = formShema.safeParse({ ...data, category: "" })
    expect(result.success).toBe(false)
    expect(findZodError(result.error, "category")).toBeTruthy()
  })

  test("should fail when date is invalid", () => {
    {
      const result = formShema.safeParse({ ...data, date: "hoge" })
      expect(result.success).toBe(false)
      expect(findZodError(result.error, "date")).toBeTruthy()
    }
    {
      const result = formShema.safeParse({
        ...data,
        date: "2024-01-01T00:00:00+09:00",
      })
      expect(result.success).toBe(false)
      expect(findZodError(result.error, "date")).toBeTruthy()
    }
  })

  test("should fail when amount is invalid", () => {
    const result = formShema.safeParse({ ...data, amount: "invalid" })
    expect(result.success).toBe(false)
    expect(findZodError(result.error, "amount")).toBeTruthy()
  })
})
