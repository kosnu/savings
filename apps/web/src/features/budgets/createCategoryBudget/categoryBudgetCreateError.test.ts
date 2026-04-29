import { describe, expect, test } from "vite-plus/test"

import {
  POSTGRES_UNIQUE_VIOLATION_CODE,
  toCategoryBudgetCreateErrorMessage,
} from "./categoryBudgetCreateError"

describe("toCategoryBudgetCreateErrorMessage", () => {
  test("PostgreSQL unique_violationは重複カテゴリ年月メッセージに変換する", () => {
    expect(
      toCategoryBudgetCreateErrorMessage({
        code: POSTGRES_UNIQUE_VIOLATION_CODE,
        message: "duplicate key value violates unique constraint",
      }),
    ).toBe("A category budget for this category and month already exists.")
  })

  test("それ以外のエラーは汎用メッセージに変換する", () => {
    expect(toCategoryBudgetCreateErrorMessage({ message: "network error" })).toBe(
      "Failed to create category budget.",
    )
    expect(toCategoryBudgetCreateErrorMessage(undefined)).toBe("Failed to create category budget.")
  })
})
