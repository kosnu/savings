import { assertEquals } from "@std/assert"
import { createUserId } from "./userId.ts"

Deno.test("createUserId returns ok for valid integer", () => {
  const result = createUserId(1)

  assertEquals(result.isOk, true)
})

Deno.test("createUserId returns err for zero integer", () => {
  const result = createUserId(0)

  assertEquals(result.isOk, false)
})

Deno.test("createUserId returns err for negative integer", () => {
  const result = createUserId(-5)

  assertEquals(result.isOk, false)
})
