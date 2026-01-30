import { assertEquals } from "@std/assert"
import { createNote } from "./note.ts"

Deno.test("createNote returns ok for string within max length", () => {
  const value = "a".repeat(200)
  const result = createNote(value)

  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value.value, value)
  }
})

Deno.test("createNote returns ok for empty string", () => {
  const result = createNote("")

  assertEquals(result.isOk, true)
})

Deno.test("createNote returns err for string exceeding max length", () => {
  const result = createNote("a".repeat(201))

  assertEquals(result.isOk, false)
})
