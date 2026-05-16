import { describe, expect, test } from "vite-plus/test"

import { toCategoryNameUpdate } from "./categoryNameUpdateMappers"

describe("toCategoryNameUpdate", () => {
  test("カテゴリ名更新payloadに変換する", () => {
    expect(toCategoryNameUpdate({ categoryId: 10, name: "Groceries" })).toEqual({
      name: "Groceries",
    })
  })
})
