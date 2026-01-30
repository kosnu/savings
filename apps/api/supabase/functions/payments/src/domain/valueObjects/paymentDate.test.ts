import { assertEquals } from "@std/assert"
import { createPaymentDate } from "./paymentDate.ts"

Deno.test("createPaymentDate returns ok for valid date", () => {
  const date = new Date("2025-01-15T12:00:00.000Z")
  const result = createPaymentDate(date)

  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value.value, date)
  }
})
