import { assertEquals } from "@std/assert"
import { createPaymentId } from "./paymentId.ts"

Deno.test("createPaymentId returns ok for valid bigint", () => {
  const result = createPaymentId(1n)

  assertEquals(result.isOk, true)
})

Deno.test("createPaymentId returns err for zero bigint", () => {
  const result = createPaymentId(0n)

  assertEquals(result.isOk, false)
})

Deno.test("createPaymentId returns err for negative bigint", () => {
  const result = createPaymentId(-5n)

  assertEquals(result.isOk, false)
})
