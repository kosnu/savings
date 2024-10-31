import { expect, test } from "vitest"
import { formatDateToIsoString } from "./formatDateToIsoString"

test("Date型を指定した時にISO 8601形式の文字列を返すこと", () => {
  expect(formatDateToIsoString(new Date(2024, 8, 22, 20, 30, 45))).toBe(
    "2024-09-22T20:30:45+09:00",
  )
})

test("日付の文字列を指定した時にISO 8601形式の文字列を返すこと", () => {
  expect(formatDateToIsoString("2024/09/22")).toBe("2024-09-22T00:00:00+09:00")
})
