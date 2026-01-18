import { createAmount } from "./amount.ts"
import { assertEquals } from "@std/assert"

Deno.test("createAmount returns ok for valid positive integer", () => {
  const result = createAmount(100)

  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value.value, 100)
  }
})

Deno.test("createAmount returns err for non-integer value", () => {
  const result = createAmount(99.99)

  assertEquals(result.isOk, false)
})
