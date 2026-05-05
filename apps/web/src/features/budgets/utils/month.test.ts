import { describe, expect, test } from "vite-plus/test"

import { toMonthStartDate } from "./month"

describe("toMonthStartDate", () => {
  test("月中の日付を同じ年月の月初日に丸める", () => {
    expect(toMonthStartDate(new Date(2026, 2, 20))).toEqual(new Date(2026, 2, 1))
  })

  test("月末の日付を同じ年月の月初日に丸める", () => {
    expect(toMonthStartDate(new Date(2025, 6, 31))).toEqual(new Date(2025, 6, 1))
  })
})
