import { assertEquals } from "@std/assert"
import { parsePrice } from "./parsePrice.ts"

Deno.test("parsePrice: カンマ区切り・円記号ありの数値文字列を正しくパースする", () => {
  assertEquals(parsePrice("1,234"), 1234)
  assertEquals(parsePrice("12,345,678"), 12345678)
  assertEquals(parsePrice("¥1,000"), 1000)
  assertEquals(parsePrice("¥12,345,678"), 12345678)
})

Deno.test("parsePrice: 数値文字列のみも正しくパースする", () => {
  assertEquals(parsePrice("1000"), 1000)
  assertEquals(parsePrice("0"), 0)
})

Deno.test("parsePrice: 空文字列や不正な文字列はNaNを返す", () => {
  assertEquals(Number.isNaN(parsePrice("")), true)
  assertEquals(Number.isNaN(parsePrice("abc")), true)
  assertEquals(Number.isNaN(parsePrice("¥,abc")), true)
})
