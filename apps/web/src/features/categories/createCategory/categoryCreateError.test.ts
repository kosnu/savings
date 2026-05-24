import { describe, expect, test } from "vite-plus/test"

import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../utils/postgresError"
import { toCategoryCreateErrorMessage } from "./categoryCreateError"

describe("toCategoryCreateErrorMessage", () => {
  test("カテゴリ名重複エラーを表示用メッセージに変換する", () => {
    expect(
      toCategoryCreateErrorMessage({
        code: POSTGRES_UNIQUE_VIOLATION_CODE,
        message: "duplicate key value violates unique constraint",
      }),
    ).toBe("A category with this name already exists.")
  })

  test("その他のエラーを汎用メッセージに変換する", () => {
    expect(toCategoryCreateErrorMessage({ message: "network error" })).toBe(
      "Failed to create category.",
    )
  })
})
