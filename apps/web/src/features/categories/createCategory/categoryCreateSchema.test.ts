import { describe, expect, test } from "vite-plus/test"
import z from "zod"

import { CATEGORY_NAME_MAX_LENGTH } from "../categorySchema"
import { categoryCreateSchema } from "./categoryCreateSchema"

describe("categoryCreateSchema", () => {
  test("カテゴリ名とピン留め状態で作成できる", () => {
    const result = categoryCreateSchema.safeParse({
      name: "Groceries",
      budgetAmount: "",
      pinned: false,
    })

    expect(result.success).toBe(true)
  })

  test("0円予算を作成値として許可する", () => {
    const result = categoryCreateSchema.safeParse({
      name: "Groceries",
      budgetAmount: "0",
      pinned: false,
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      name: "Groceries",
      budgetAmount: 0,
      pinned: false,
    })
  })

  test("カテゴリ名は20文字以下に制限する", () => {
    const result = categoryCreateSchema.safeParse({
      name: "a".repeat(CATEGORY_NAME_MAX_LENGTH + 1),
      budgetAmount: "",
      pinned: false,
    })

    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.name
    expect(error).toEqual([`Category name must be ${CATEGORY_NAME_MAX_LENGTH} characters or less`])
  })
})
