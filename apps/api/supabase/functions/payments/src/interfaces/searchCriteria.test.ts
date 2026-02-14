import * as z from "@zod/zod"
import { assert, assertEquals } from "@std/assert"
import { SearchCriteriaSchema } from "./searchCriteria.ts"

Deno.test("userIdのみならパースに成功する", () => {
  const result = SearchCriteriaSchema.safeParse({ userId: 1 })

  assert(result.success)
  assertEquals(result.data, {
    userId: 1,
    dateFrom: undefined,
    dateTo: undefined,
  })
})

Deno.test("userIdとdateFromのみならパースに成功する", () => {
  const result = SearchCriteriaSchema.safeParse({
    userId: 1,
    dateFrom: "2024-01-01",
  })

  assert(result.success)
  assertEquals(result.data, {
    userId: 1,
    dateFrom: "2024-01-01",
  })
})

Deno.test("userIdとdateToのみならパースに成功する", () => {
  const result = SearchCriteriaSchema.safeParse({
    userId: 1,
    dateTo: "2024-01-31",
  })

  assert(result.success)
  assertEquals(result.data, {
    userId: 1,
    dateTo: "2024-01-31",
  })
})

Deno.test("userIdとdateFrom/dateToがISO日付ならパースに成功する", () => {
  const result = SearchCriteriaSchema.safeParse({
    userId: 1,
    dateFrom: "2024-01-01",
    dateTo: "2024-01-31",
  })

  assert(result.success)
  assertEquals(result.data, {
    userId: 1,
    dateFrom: "2024-01-01",
    dateTo: "2024-01-31",
  })
})

Deno.test("userIdが0ならパースに失敗する", () => {
  const result = SearchCriteriaSchema.safeParse({ userId: 0 })

  assertEquals(result.success, false)
  if (result.success) return
  const errors = z.flattenError(result.error).fieldErrors
  assert(errors.userId)
})

Deno.test("dateFromが不正形式ならパースに失敗する", () => {
  const result = SearchCriteriaSchema.safeParse({
    userId: 1,
    dateFrom: "2024/01/01",
  })

  assertEquals(result.success, false)
  if (result.success) return
  const errors = z.flattenError(result.error).fieldErrors
  assert(errors.dateFrom)
})

Deno.test("dateToが不正形式ならパースに失敗する", () => {
  const result = SearchCriteriaSchema.safeParse({
    userId: 1,
    dateTo: "2024/01/31",
  })

  assertEquals(result.success, false)
  if (result.success) return
  const errors = z.flattenError(result.error).fieldErrors
  assert(errors.dateTo)
})

Deno.test("dateFromが存在しない日付ならパースに失敗する", () => {
  const result = SearchCriteriaSchema.safeParse({
    userId: 1,
    dateFrom: "2025-02-32",
  })

  assertEquals(result.success, false)
  if (result.success) return
  const errors = z.flattenError(result.error).fieldErrors
  assert(errors.dateFrom)
})

Deno.test("dateToが存在しない日付ならパースに失敗する", () => {
  const result = SearchCriteriaSchema.safeParse({
    userId: 1,
    dateTo: "2025-02-32",
  })

  assertEquals(result.success, false)
  if (result.success) return
  const errors = z.flattenError(result.error).fieldErrors
  assert(errors.dateTo)
})

Deno.test("dateFrom/dateToが空文字ならパースに失敗する", () => {
  const result = SearchCriteriaSchema.safeParse({
    userId: 1,
    dateFrom: "",
    dateTo: "",
  })

  assertEquals(result.success, false)
  if (result.success) return
  const errors = z.flattenError(result.error).fieldErrors
  assert(errors.dateFrom)
  assert(errors.dateTo)
})
