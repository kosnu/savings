import { assertEquals } from "@std/assert"
import { validateCriteria } from "./validateCriteria.ts"

Deno.test("dateFrom/dateToが未指定ならundefinedを返す", () => {
  const result = validateCriteria()

  assertEquals(result, undefined)
})

Deno.test("dateFrom/dateToがYYYY-MM-DDならundefinedを返す", () => {
  const result = validateCriteria("2024-01-01", "2024-01-31")

  assertEquals(result, undefined)
})

Deno.test("dateFromが不正ならValidationErrorを返す", () => {
  const result = validateCriteria("2024/01/01", "2024-01-31")

  assertEquals(result, {
    type: "ValidationError",
    message: "dateFrom must be YYYY-MM-DD",
    details: { dateFrom: "2024/01/01" },
  })
})

Deno.test("dateToが不正ならValidationErrorを返す", () => {
  const result = validateCriteria("2024-01-01", "2024/01/31")

  assertEquals(result, {
    type: "ValidationError",
    message: "dateTo must be YYYY-MM-DD",
    details: { dateTo: "2024/01/31" },
  })
})
