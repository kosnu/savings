import { getTimestamp } from "./getTimestamp.ts"
import { assertEquals } from "https://deno.land/std@0.203.0/assert/mod.ts"

Deno.test("getTimestamp: 指定したDateをISO8601文字列で返す", () => {
  const date = new Date("2023-01-01T12:34:56.789Z")
  const result = getTimestamp(date)
  assertEquals(result, "2023-01-01T12:34:56.789Z")
})

Deno.test("getTimestamp: 引数なしの場合は現在時刻のISO8601文字列を返す (Dateをモック)", () => {
  // モック用の固定日付
  const fixedDate = new Date("2025-08-31T12:00:00.000Z")
  // Dateのグローバルを一時的に差し替え
  const OriginalDate = Date // @ts-ignore 型エラーを無視してDateを上書き
  ;(globalThis as unknown as { Date: typeof Date }).Date = class
    extends OriginalDate {
    constructor() {
      super()
      return fixedDate
    }
    static override now() {
      return fixedDate.getTime()
    }
  }
  try {
    const result = getTimestamp()
    assertEquals(result, "2025-08-31T12:00:00.000Z")
  } finally {
    // Dateを元に戻す
    ;(globalThis as unknown as { Date: typeof Date }).Date = OriginalDate
  }
})
