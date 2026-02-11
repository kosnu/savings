import { assertEquals } from "@std/assert"
import { createPaymentId } from "./paymentId.ts"

Deno.test("createPaymentId returns ok for valid integer", () => {
  const result = createPaymentId(1)

  assertEquals(result.isOk, true)
})

Deno.test("createPaymentId returns err for zero integer", () => {
  const result = createPaymentId(0)

  assertEquals(result.isOk, false)
})

Deno.test("createPaymentId returns err for negative integer", () => {
  const result = createPaymentId(-5)

  assertEquals(result.isOk, false)
})
