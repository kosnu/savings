import { describe, expect, it } from "vite-plus/test"

import { exportPaymentsSchema } from "./exportPaymentsSchema"

describe("CSV出力期間", () => {
  it.each([
    ["2024-02-29", "2024-02-29", true],
    ["9999-01-01", "9999-12-31", true],
    ["2020-01-01", "2026-12-31", false],
    ["2026-01-01", "2026-12-31", true],
    ["2026-01-01", "2027-01-01", false],
    ["2024-02-29", "2025-02-28", true],
    ["2024-02-29", "2025-03-01", false],
    ["2023-03-01", "2024-02-29", true],
    ["2023-03-01", "2024-03-01", false],
    ["2026-10-31", "2026-10-01", false],
    ["2026-02-29", "2026-03-01", false],
    ["", "2026-10-01", false],
    ["2026-10-01", "", false],
    ["2026-1-1", "2026-10-01", false],
  ])("%s から %s の有効性は %s", (startDate, endDate, valid) => {
    expect(exportPaymentsSchema.safeParse({ startDate, endDate }).success).toBe(valid)
  })
})
