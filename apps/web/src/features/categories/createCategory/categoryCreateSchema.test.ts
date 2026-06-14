import { describe, expect, test } from "vite-plus/test"
import z from "zod"

import { CATEGORY_NAME_MAX_LENGTH } from "../categorySchema"
import { categoryCreateSchema } from "./categoryCreateSchema"

describe("categoryCreateSchema", () => {
  test("カテゴリ名、ピン留め状態、任意の予算額で作成できる", () => {
    const result = categoryCreateSchema.safeParse({
      name: "Groceries",
      budgetAmount: "0",
      pinned: false,
    })

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      budgetAmount: 0,
    })
  })

  test("カテゴリ名は20文字以下に制限する", () => {
    const result = categoryCreateSchema.safeParse({
      name: "a".repeat(CATEGORY_NAME_MAX_LENGTH + 1),
      pinned: false,
    })

    expect(result.success).toBe(false)
    const error = result.error && z.flattenError(result.error).fieldErrors.name
    expect(error).toEqual([`Category name must be ${CATEGORY_NAME_MAX_LENGTH} characters or less`])
  })
})
