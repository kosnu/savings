import { createCategoryId } from "./categoryId.ts"
import { assertEquals } from "@std/assert"

Deno.test("createCategoryId returns ok for valid positive bigint", () => {
  const result = createCategoryId(100n)
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value.value, 100n)
  }
})

Deno.test("createCategoryId returns err for non-positive bigint", () => {
  const result = createCategoryId(0n)

  assertEquals(result.isOk, false)
})
