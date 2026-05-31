import { describe, expect, test } from "vite-plus/test"
import z from "zod"

import { CATEGORY_NAME_MAX_LENGTH } from "../categorySchema"
import { categoryCreateSchema } from "./categoryCreateSchema"

describe("categoryCreateSchema", () => {
  test("カテゴリ名とピン留め状態で作成できる", () => {
    const result = categoryCreateSchema.safeParse({
      name: "Groceries",
      pinned: false,
    })

    expect(result.success).toBe(true)
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
