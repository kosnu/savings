import { describe, expect, test } from "vite-plus/test"
import z from "zod"

import { CATEGORY_NAME_MAX_LENGTH } from "../categorySchema"
import { categoryCreateSchema } from "./categoryCreateSchema"

describe("categoryCreateSchema", () => {
  test("カテゴリ名だけで作成できる", () => {
    const result = categoryCreateSchema.safeParse({
      name: "Groceries",
      budgetAmount: undefined,
    })

    expect(result.success).toBe(true)
  })

  test("カテゴリ名と月予算金額で作成できる", () => {
    const result = categoryCreateSchema.safeParse({
      name: "Groceries",
      budgetAmount: 50000,
    })

    expect(result.success).toBe(true)
  })

  test("文字列の月予算金額を数値として受け付ける", () => {
    const result = categoryCreateSchema.safeParse({
      name: "Groceries",
      budgetAmount: "50000",
    })

    expect(result.success).toBe(true)
    expect(result.data?.budgetAmount).toBe(50000)
  })

  test("空の月予算金額は未指定として扱う", () => {
    const result = categoryCreateSchema.safeParse({
      name: "Groceries",
      budgetAmount: "",
    })

    expect(result.success).toBe(true)
    expect(result.data?.budgetAmount).toBeUndefined()
  })

  test("カテゴリ名は20文字以下に制限する", () => {
    const result = categoryCreateSchema.safeParse({
      name: "a".repeat(CATEGORY_NAME_MAX_LENGTH + 1),
      budgetAmount: undefined,
    })

    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.name
    expect(error).toEqual([`Category name must be ${CATEGORY_NAME_MAX_LENGTH} characters or less`])
  })

  test("月予算金額が負数の場合は拒否する", () => {
    const result = categoryCreateSchema.safeParse({
      name: "Groceries",
      budgetAmount: -1,
    })

    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.budgetAmount
    expect(error).toEqual(["Amount must be a non-negative integer"])
  })

  test("月予算金額が文字列として不正な場合は拒否する", () => {
    const result = categoryCreateSchema.safeParse({
      name: "Groceries",
      budgetAmount: "invalid",
    })

    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.budgetAmount
    expect(error).toEqual(["Amount must be a number"])
  })
})
