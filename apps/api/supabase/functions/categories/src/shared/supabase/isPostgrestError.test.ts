import { PostgrestError } from "@supabase/supabase-js"
import { isPostgrestError } from "./isPostgrestError.ts"
import { assertEquals } from "@std/assert"

Deno.test("isPostgrestError returns true for PostgrestError", () => {
  const error = new PostgrestError({
    message: "An error occurred",
    details: "Error details",
    hint: "Error hint",
    code: "400",
  })

  const result = isPostgrestError(error)
  assertEquals(result, true)
})

Deno.test("isPostgrestError returns true for object with PostgrestError properties", () => {
  const error = {
    message: "An error occurred",
    details: "Error details",
    hint: "Error hint",
    code: "400",
  }

  const result = isPostgrestError(error)
  assertEquals(result, true)
})

Deno.test("isPostgrestError returns false for non-PostgrestError", () => {
  const error = new Error("A general error")

  const result = isPostgrestError(error)
  assertEquals(result, false)
})

Deno.test("isPostgrestError returns false for null", () => {
  const result = isPostgrestError(null)
  assertEquals(result, false)
})

Deno.test("isPostgrestError returns false for primitive types", () => {
  const values = [42, "string", true, undefined]

  for (const value of values) {
    const result = isPostgrestError(value)
    assertEquals(result, false)
  }
})
