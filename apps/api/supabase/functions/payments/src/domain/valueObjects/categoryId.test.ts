import { createCategoryId } from "./categoryId.ts"
import { assertEquals } from "@std/assert"

Deno.test("createCategoryId returns ok for valid positive integer", () => {
  const result = createCategoryId(100)
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value.value, 100)
  }
})

Deno.test("createCategoryId returns err for non-positive integer", () => {
  const result = createCategoryId(0)

  assertEquals(result.isOk, false)
})
