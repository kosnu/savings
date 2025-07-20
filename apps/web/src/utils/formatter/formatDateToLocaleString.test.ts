import { expect, test } from "vitest"
import { formatDateToLocaleString } from "./formatDateToLocaleString"

test("Date型を指定した時に年月日の文字列を返すこと", () => {
  expect(formatDateToLocaleString(new Date(2024, 8, 22, 20, 30, 45))).toBe(
    "2024/09/22",
  )
})

test("日付の文字列を指定した形式の文字列を返すこと", () => {
  expect(formatDateToLocaleString("2024/09/22", "yyyy/MM/dd HH:mm")).toBe(
    "2024/09/22 00:00",
  )
})
