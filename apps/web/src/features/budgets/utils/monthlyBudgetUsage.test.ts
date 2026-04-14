import { describe, expect, test } from "vitest"

import { getMonthlyBudgetUsageDisplay } from "./monthlyBudgetUsage"

describe("getMonthlyBudgetUsageDisplay", () => {
  test("支出が月予算以下なら残額を表示する", () => {
    expect(getMonthlyBudgetUsageDisplay(10000, 30000)).toEqual({
      text: "￥20,000 left",
      status: "remaining",
    })
  })

  test("支出が月予算と同額なら ￥0 left を表示する", () => {
    expect(getMonthlyBudgetUsageDisplay(30000, 30000)).toEqual({
      text: "￥0 left",
      status: "remaining",
    })
  })

  test("支出が月予算を超えたら超過額を表示する", () => {
    expect(getMonthlyBudgetUsageDisplay(45000, 30000)).toEqual({
      text: "￥15,000 over",
      status: "over",
    })
  })

  test("支出または月予算がない場合は表示しない", () => {
    expect(getMonthlyBudgetUsageDisplay(null, 30000)).toBeNull()
    expect(getMonthlyBudgetUsageDisplay(10000, null)).toBeNull()
  })
})
