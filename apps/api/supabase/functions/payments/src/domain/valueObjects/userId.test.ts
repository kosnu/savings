import { assertEquals } from "@std/assert"
import { createUserId } from "./userId.ts"

Deno.test("createUserId returns ok for valid bigint", () => {
  const result = createUserId(1n)

  assertEquals(result.isOk, true)
})

Deno.test("createUserId returns err for zero bigint", () => {
  const result = createUserId(0n)

  assertEquals(result.isOk, false)
})

Deno.test("createUserId returns err for negative bigint", () => {
  const result = createUserId(-5n)

  assertEquals(result.isOk, false)
})
