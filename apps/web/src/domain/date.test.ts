import { describe, expect, test } from "vite-plus/test"

import {
  formatTargetMonthKey,
  parseDateOnlyStringToLocalDate,
  toDateOnlyString,
  toMonthEndDateOnlyString,
  toMonthStartDate,
  toTargetMonth,
} from "./date"

describe("toMonthStartDate", () => {
  test("月中の日付を同じ年月の月初日に丸める", () => {
    expect(toMonthStartDate(new Date(2026, 2, 20))).toEqual(new Date(2026, 2, 1))
  })

  test("月末の日付を同じ年月の月初日に丸める", () => {
    expect(toMonthStartDate(new Date(2025, 6, 31))).toEqual(new Date(2025, 6, 1))
  })
})

describe("toMonthEndDateOnlyString", () => {
  test("同じ年月の月末日をdate-only文字列にする", () => {
    expect(toMonthEndDateOnlyString(new Date(2026, 1, 1))).toBe("2026-02-28")
    expect(toMonthEndDateOnlyString(new Date(2024, 1, 10))).toBe("2024-02-29")
  })
})

describe("toDateOnlyString", () => {
  test("Dateをdate-only文字列にする", () => {
    expect(toDateOnlyString(new Date(2024, 8, 22, 12, 34, 56))).toBe("2024-09-22")
  })
})

describe("parseDateOnlyStringToLocalDate", () => {
  test("date-only文字列をlocal Dateにする", () => {
    expect(parseDateOnlyStringToLocalDate("2024-09-22")).toEqual(new Date(2024, 8, 22))
  })
})

describe("toTargetMonth", () => {
  test("Dateから年月を取り出す", () => {
    expect(toTargetMonth(new Date(2025, 4, 31))).toEqual({ year: 2025, month: 5 })
  })
})

describe("formatTargetMonthKey", () => {
  test("年月を月2桁のkeyにする", () => {
    expect(formatTargetMonthKey({ year: 2025, month: 5 })).toBe("2025-05")
  })
})
