import { assertEquals } from "@std/assert"
import { err, ok } from "../../shared/result.ts"
import { validationError } from "../../shared/errors.ts"
import { createCategoryId } from "./categoryId.ts"

Deno.test("createCategoryId", () => {
  const validId = 1n
  const invalidId = 0n

  const result = createCategoryId(validId)

  assertEquals(result, ok({ value: validId }))

  const errorResult = createCategoryId(invalidId)
  assertEquals(
    errorResult,
    err(
      validationError("CategoryId must be a positive integer", {
        value: invalidId,
      }),
    ),
  )
})
