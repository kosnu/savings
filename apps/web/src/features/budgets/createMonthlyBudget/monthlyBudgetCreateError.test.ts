import { describe, expect, test } from "vite-plus/test"

import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../utils/postgresError"
import { toMonthlyBudgetCreateErrorMessage } from "./monthlyBudgetCreateError"

describe("toMonthlyBudgetCreateErrorMessage", () => {
  test("PostgreSQL unique_violationは重複年月メッセージに変換する", () => {
    expect(
      toMonthlyBudgetCreateErrorMessage({
        code: POSTGRES_UNIQUE_VIOLATION_CODE,
        message: "duplicate key value violates unique constraint",
      }),
    ).toBe("A monthly budget for this month already exists.")
  })

  test("それ以外のエラーは汎用メッセージに変換する", () => {
    expect(toMonthlyBudgetCreateErrorMessage({ message: "network error" })).toBe(
      "Failed to create monthly budget.",
    )
    expect(toMonthlyBudgetCreateErrorMessage(undefined)).toBe("Failed to create monthly budget.")
  })
})
