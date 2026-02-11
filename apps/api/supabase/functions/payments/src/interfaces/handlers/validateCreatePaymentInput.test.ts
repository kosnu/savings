import { assertEquals } from "@std/assert"
import { validateCreatePaymentInput } from "./validateCreatePaymentInput.ts"

Deno.test("正常な入力をパースできる", () => {
  const result = validateCreatePaymentInput({
    amount: 1200,
    date: "2024-01-10",
    note: "ランチ",
    categoryId: 2,
  })

  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value, {
      amount: 1200,
      date: "2024-01-10",
      note: "ランチ",
      categoryId: 2,
    })
  }
})

Deno.test("note が空文字なら null に正規化する", () => {
  const result = validateCreatePaymentInput({
    amount: 1200,
    date: "2024-01-10",
    note: "",
  })

  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value.note, null)
  }
})

Deno.test("body がオブジェクトでない場合は ValidationError", () => {
  const result = validateCreatePaymentInput("invalid")

  assertEquals(result.isOk, false)
  if (!result.isOk) {
    assertEquals(result.error.type, "ValidationError")
  }
})

Deno.test("amount が数値でない場合は ValidationError", () => {
  const result = validateCreatePaymentInput({
    amount: "1200",
    date: "2024-01-10",
  })

  assertEquals(result.isOk, false)
  if (!result.isOk) {
    assertEquals(result.error.message, "amount must be a number")
  }
})

Deno.test("date が文字列でない場合は ValidationError", () => {
  const result = validateCreatePaymentInput({
    amount: 1200,
    date: 20240110,
  })

  assertEquals(result.isOk, false)
  if (!result.isOk) {
    assertEquals(result.error.message, "date must be a string")
  }
})

Deno.test("note が文字列/nullable 以外なら ValidationError", () => {
  const result = validateCreatePaymentInput({
    amount: 1200,
    date: "2024-01-10",
    note: 123,
  })

  assertEquals(result.isOk, false)
  if (!result.isOk) {
    assertEquals(result.error.message, "note must be a string or null")
  }
})

Deno.test("categoryId が整数でない場合は ValidationError", () => {
  const result = validateCreatePaymentInput({
    amount: 1200,
    date: "2024-01-10",
    categoryId: 1.5,
  })

  assertEquals(result.isOk, false)
  if (!result.isOk) {
    assertEquals(result.error.message, "categoryId must be an integer")
  }
})
