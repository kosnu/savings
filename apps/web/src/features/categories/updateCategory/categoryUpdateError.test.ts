import { describe, expect, test } from "vite-plus/test"

import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../utils/postgresError"
import { toCategoryUpdateErrorMessage } from "./categoryUpdateError"

describe("toCategoryUpdateErrorMessage", () => {
  test("PostgreSQL unique_violationは重複カテゴリ名メッセージに変換する", () => {
    expect(
      toCategoryUpdateErrorMessage({
        code: POSTGRES_UNIQUE_VIOLATION_CODE,
        message: "duplicate key value violates unique constraint",
      }),
    ).toBe("A category with this name already exists.")
  })

  test("その他のエラーは汎用メッセージに変換する", () => {
    expect(toCategoryUpdateErrorMessage({ message: "network error" })).toBe(
      "Failed to update category.",
    )
  })
})
