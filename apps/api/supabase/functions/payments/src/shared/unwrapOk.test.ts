import { assertEquals, assertThrows } from "@std/assert"
import { Result } from "./result.ts"
import { unwrapOk } from "./unwrapOk.ts"

Deno.test("unwrapOk returns the value when Result is Ok", () => {
  const okResult: Result<number, string> = {
    isOk: true,
    value: 42,
  }

  const value = unwrapOk(okResult)
  assertEquals(value, 42)
})

Deno.test("unwrapOk throws the error when Result is Err", () => {
  const errResult: Result<number, string> = {
    isOk: false,
    error: "An error occurred",
  }

  assertThrows(() => {
    unwrapOk(errResult)
  }, "An error occurred")
})
