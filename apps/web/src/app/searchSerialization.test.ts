import { describe, expect, test } from "vite-plus/test"

import { parseSearch, stringifySearch } from "./searchSerialization"

describe("searchSerialization", () => {
  test("文字列の数値を引用符なしでURL searchにする", () => {
    expect(stringifySearch({ category: "4" })).toBe("?category=4")
  })

  test("objectとarrayをURL searchから復元する", () => {
    const search = {
      filter: { category: "4" },
      ids: ["1", "2"],
    }

    expect(parseSearch(stringifySearch(search))).toEqual(search)
  })
})
