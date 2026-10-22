import { describe, expect, test } from "vite-plus/test"

import {
  formatTargetMonthKey,
  clampDateToSupportedRange,
  isSelectableMonth,
  isSupportedDate,
  parseDateOnlyStringToLocalDate,
  resolveTargetMonth,
  toDateOnlyString,
  toMonthEndDateOnlyString,
  toMonthStartDate,
  toTargetMonth,
} from "./date"

describe("年月の許容範囲", () => {
  test.each([
    [new Date(2022, 0, 1), true],
    [new Date(2032, 11, 31, 23, 59, 59, 999), true],
    [new Date(2021, 11, 31), false],
    [new Date(2033, 0, 1), false],
    [new Date(NaN), false],
  ])("日付 %s の許容判定は %s", (date, expected) => {
    expect(isSupportedDate(date)).toBe(expected)
  })

  test.each([
    [{ year: 2022, month: 1 }, true],
    [{ year: 2032, month: 12 }, true],
    [{ year: 2021, month: 12 }, false],
    [{ year: 2033, month: 1 }, false],
    [{ year: 2026, month: 0 }, false],
    [{ year: 2026, month: 13 }, false],
    [{ year: 2026.5, month: 1 }, false],
    [{ year: Infinity, month: 1 }, false],
  ])("年月 %o の許容判定は %s", (month, expected) => {
    expect(isSelectableMonth(month)).toBe(expected)
  })

  test("現在日付由来の入力を端へ収め、有効な時刻は維持する", () => {
    expect(clampDateToSupportedRange(new Date(2021, 11, 31))).toEqual(new Date(2022, 0, 1))
    expect(clampDateToSupportedRange(new Date(2033, 0, 1))).toEqual(new Date(2032, 11, 31))
    const date = new Date(2026, 9, 22, 12)
    expect(clampDateToSupportedRange(date)).toEqual(date)
    expect(() => clampDateToSupportedRange(new Date(NaN))).toThrow(RangeError)
  })

  test.each([
    [undefined, undefined, new Date(2021, 11, 31), { year: 2022, month: 1 }],
    [undefined, undefined, new Date(2033, 0, 1), { year: 2032, month: 12 }],
    ["2025", undefined, new Date(2033, 0, 1), { year: 2025, month: 1 }],
    [undefined, "6", new Date(2033, 0, 1), { year: 2032, month: 12 }],
    ["2022", "1", new Date(2026, 9, 22), { year: 2022, month: 1 }],
    ["2032", "12", new Date(2026, 9, 22), { year: 2032, month: 12 }],
    ["foo", "1", new Date(2026, 9, 22), { year: 2026, month: 10 }],
    ["2021", "12", new Date(2026, 9, 22), { year: 2026, month: 10 }],
    ["999999999999999", "1", new Date(2026, 9, 22), { year: 2026, month: 10 }],
  ])("検索年月を同じ有限の期間へ正規化する", (year, month, now, expected) => {
    expect(resolveTargetMonth(year, month, now)).toEqual(expected)
  })

  test("範囲外の保存済み日付は読み取り時に書き換えない", () => {
    expect(toDateOnlyString(parseDateOnlyStringToLocalDate("2021-12-31"))).toBe("2021-12-31")
    expect(toDateOnlyString(parseDateOnlyStringToLocalDate("2033-01-01"))).toBe("2033-01-01")
  })
})

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
