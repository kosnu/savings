import { describe, expect, test } from "vite-plus/test"

import { parseSearch, stringifySearch } from "./searchSerialization"

describe("searchSerialization", () => {
  test("文字列の数値を引用符なしでURL searchにする", () => {
    expect(stringifySearch({ category: "4" })).toBe("?category=4")
  })

  test("引用符なしのscalar値は文字列として復元する", () => {
    expect(parseSearch("?category=4&enabled=true&empty=null")).toEqual({
      category: "4",
      enabled: "true",
      empty: "null",
    })
  })

  test("legacyのquoted stringを文字列として復元する", () => {
    expect(parseSearch("?year=%222025%22&month=%226%22")).toEqual({
      year: "2025",
      month: "6",
    })
  })

  test("objectとarrayをURL searchから復元する", () => {
    const search = {
      filter: { category: "4" },
      ids: ["1", "2"],
    }

    expect(parseSearch(stringifySearch(search))).toEqual(search)
  })
})
