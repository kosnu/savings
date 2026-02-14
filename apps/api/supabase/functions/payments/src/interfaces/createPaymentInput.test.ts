import * as z from "@zod/zod"
import { assert, assertEquals } from "@std/assert"
import { CreatePaymentInputSchema } from "./createPaymentInput.ts"

Deno.test("正常な入力をパースできる", () => {
  const result = CreatePaymentInputSchema.safeParse({
    amount: 1200,
    date: "2024-01-10",
    note: "ランチ",
    categoryId: 2,
  })

  assert(result.success)
  assertEquals(result.data, {
    amount: 1200,
    date: "2024-01-10",
    note: "ランチ",
    categoryId: 2,
  })
})

Deno.test("note が未指定/null/空文字なら null に正規化する", () => {
  const resultWithUndefined = CreatePaymentInputSchema.safeParse({
    amount: 1200,
    date: "2024-01-10",
  })
  const resultWithNull = CreatePaymentInputSchema.safeParse({
    amount: 1200,
    date: "2024-01-10",
    note: null,
  })
  const resultWithEmpty = CreatePaymentInputSchema.safeParse({
    amount: 1200,
    date: "2024-01-10",
    note: "",
  })

  assert(resultWithUndefined.success)
  assert(resultWithNull.success)
  assert(resultWithEmpty.success)
  assertEquals(resultWithUndefined.data.note, null)
  assertEquals(resultWithNull.data.note, null)
  assertEquals(resultWithEmpty.data.note, null)
})

Deno.test("categoryId が未指定/nullなら null に正規化する", () => {
  const resultWithUndefined = CreatePaymentInputSchema.safeParse({
    amount: 1200,
    date: "2024-01-10",
  })
  const resultWithNull = CreatePaymentInputSchema.safeParse({
    amount: 1200,
    date: "2024-01-10",
    categoryId: null,
  })

  assert(resultWithUndefined.success)
  assert(resultWithNull.success)
  assertEquals(resultWithUndefined.data.categoryId, null)
  assertEquals(resultWithNull.data.categoryId, null)
})

Deno.test("amount が数値でない場合はパースに失敗する", () => {
  const result = CreatePaymentInputSchema.safeParse({
    amount: "1200",
    date: "2024-01-10",
  })

  assertEquals(result.success, false)
  if (result.success) return
  const errors = z.flattenError(result.error).fieldErrors
  assert(errors.amount)
})

Deno.test("date が文字列でない場合はパースに失敗する", () => {
  const result = CreatePaymentInputSchema.safeParse({
    amount: 1200,
    date: 20240110,
  })

  assertEquals(result.success, false)
  if (result.success) return
  const errors = z.flattenError(result.error).fieldErrors
  assert(errors.date)
})

Deno.test("note が文字列/null/undefined 以外ならパースに失敗する", () => {
  const result = CreatePaymentInputSchema.safeParse({
    amount: 1200,
    date: "2024-01-10",
    note: 123,
  })

  assertEquals(result.success, false)
  if (result.success) return
  const errors = z.flattenError(result.error).fieldErrors
  assert(errors.note)
})

Deno.test("categoryId が整数でない場合はパースに失敗する", () => {
  const result = CreatePaymentInputSchema.safeParse({
    amount: 1200,
    date: "2024-01-10",
    categoryId: 1.5,
  })

  assertEquals(result.success, false)
  if (result.success) return
  const errors = z.flattenError(result.error).fieldErrors
  assert(errors.categoryId)
})
