import { convertDocData } from "./convertDocData.ts"
import { assertEquals } from "@std/assert"

Deno.test("convertDocData: 文字列値をstringValueに変換する", () => {
  const input = { name: "Alice" }
  const result = convertDocData(input)
  assertEquals(result, { name: { stringValue: "Alice" } })
})

Deno.test("convertDocData: 数値値をintegerValueに変換する", () => {
  const input = { age: 30 }
  const result = convertDocData(input)
  assertEquals(result, { age: { integerValue: 30 } })
})

Deno.test("convertDocData: Date値をtimestampValue(ISO文字列)に変換する", () => {
  const date = new Date("2023-01-01T12:00:00Z")
  const input = { createdAt: date }
  const result = convertDocData(input)
  assertEquals(result, { createdAt: { timestampValue: date.toISOString() } })
})

Deno.test("convertDocData: サポートされていない型（boolean, object, array, null, undefined）は無視する", () => {
  const input = {
    bool: true,
    obj: { foo: "bar" },
    arr: [1, 2, 3],
    nil: null,
    undef: undefined,
  }
  const result = convertDocData(input)
  assertEquals(result, {})
})

Deno.test("convertDocData: 複数型が混在する場合も正しく変換する", () => {
  const date = new Date("2023-01-01T12:00:00Z")
  const input = {
    name: "Bob",
    age: 25,
    createdAt: date,
    bool: false,
    arr: [],
  }
  const result = convertDocData(input)
  assertEquals(result, {
    name: { stringValue: "Bob" },
    age: { integerValue: 25 },
    createdAt: { timestampValue: date.toISOString() },
  })
})
