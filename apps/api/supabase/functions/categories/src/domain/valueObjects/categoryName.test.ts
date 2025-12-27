import { assertEquals } from "@std/assert"
import { validationError } from "../../shared/errors.ts"
import { err, ok } from "../../shared/result.ts"
import { createCategoryName } from "./categoryName.ts"

Deno.test("createCategoryName", () => {
  const validName = "Example Category"
  const invalidName = "   "

  const result = createCategoryName(validName)

  assertEquals(result, ok({ value: validName }))

  const errorResult = createCategoryName(invalidName)
  assertEquals(
    errorResult,
    err(
      validationError("CategoryName cannot be empty"),
    ),
  )
})
