import { describe, expect, test } from "vite-plus/test"
import z from "zod"

import { CATEGORY_NAME_MAX_LENGTH, categoryNameSchema } from "./categorySchema"

describe("categoryNameSchema", () => {
  test("20文字以下のカテゴリ名を許可する", () => {
    const result = categoryNameSchema.safeParse("a".repeat(CATEGORY_NAME_MAX_LENGTH))

    expect(result.success).toBe(true)
  })

  test("20文字を超えるカテゴリ名を拒否する", () => {
    const result = categoryNameSchema.safeParse("a".repeat(CATEGORY_NAME_MAX_LENGTH + 1))

    expect(result.success).toBe(false)

    const error = result.error && z.flattenError(result.error).formErrors
    expect(error).toEqual([`Category name must be ${CATEGORY_NAME_MAX_LENGTH} characters or less`])
  })
})
