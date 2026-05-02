import { describe, expect, test } from "vite-plus/test"

import { PAYMENT_SEARCH_CATEGORY_NONE_VALUE, paymentsSearchSchema } from "./paymentsSearchSchema"

describe("paymentsSearchSchema", () => {
  test("年月のみの URL search を扱える", () => {
    const result = paymentsSearchSchema.parse({ year: "2025", month: "5" })

    expect(result).toEqual({ year: "2025", month: "5" })
  })

  test("登録済みカテゴリ ID の URL search を扱える", () => {
    const result = paymentsSearchSchema.parse({ category: "10" })

    expect(result).toEqual({ category: "10" })
  })

  test("年月と登録済みカテゴリ ID を併用できる", () => {
    const result = paymentsSearchSchema.parse({ year: "2025", month: "5", category: "10" })

    expect(result).toEqual({ year: "2025", month: "5", category: "10" })
  })

  test("カテゴリ未設定の URL search を扱える", () => {
    const result = paymentsSearchSchema.parse({
      category: PAYMENT_SEARCH_CATEGORY_NONE_VALUE,
    })

    expect(result).toEqual({ category: PAYMENT_SEARCH_CATEGORY_NONE_VALUE })
  })

  test.each(["0", "-1", "1.2", "abc", ""])("不正なカテゴリ条件 %s は条件なしにする", (category) => {
    const result = paymentsSearchSchema.parse({ year: "2025", month: "5", category })

    expect(result).toEqual({ year: "2025", month: "5", category: undefined })
  })
})
