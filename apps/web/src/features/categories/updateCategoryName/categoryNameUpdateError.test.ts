import { describe, expect, test } from "vite-plus/test"

import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../utils/postgresError"
import { toCategoryNameUpdateErrorMessage } from "./categoryNameUpdateError"

describe("toCategoryNameUpdateErrorMessage", () => {
  test("PostgreSQL unique_violationは重複カテゴリ名メッセージに変換する", () => {
    expect(
      toCategoryNameUpdateErrorMessage({
        code: POSTGRES_UNIQUE_VIOLATION_CODE,
        message: "duplicate key value violates unique constraint",
      }),
    ).toBe("A category with this name already exists.")
  })

  test("その他のエラーは汎用メッセージに変換する", () => {
    expect(toCategoryNameUpdateErrorMessage({ message: "network error" })).toBe(
      "Failed to update category.",
    )
  })
})
