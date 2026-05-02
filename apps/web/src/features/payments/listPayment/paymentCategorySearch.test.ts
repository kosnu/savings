import { describe, expect, test } from "vite-plus/test"

import { toPaymentCategoryId, toPaymentCategorySearch } from "./paymentCategorySearch"
import { PAYMENT_SEARCH_CATEGORY_NONE_VALUE } from "./paymentsSearchSchema"

describe("toPaymentCategoryId", () => {
  test("登録済みカテゴリIDのURL searchをnumberに変換する", () => {
    expect(toPaymentCategoryId("10")).toBe(10)
  })

  test("カテゴリ未設定のURL searchをnullに変換する", () => {
    expect(toPaymentCategoryId(PAYMENT_SEARCH_CATEGORY_NONE_VALUE)).toBeNull()
  })

  test.each([undefined, "0", "-1", "1.2", "abc"])(
    "カテゴリ条件に使わないURL search %s はundefinedに変換する",
    (categorySearch) => {
      expect(toPaymentCategoryId(categorySearch)).toBeUndefined()
    },
  )
})

describe("toPaymentCategorySearch", () => {
  test("登録済みカテゴリIDのURL searchを正規化する", () => {
    expect(toPaymentCategorySearch("10")).toBe("10")
  })

  test("カテゴリ未設定のURL searchを維持する", () => {
    expect(toPaymentCategorySearch(PAYMENT_SEARCH_CATEGORY_NONE_VALUE)).toBe(
      PAYMENT_SEARCH_CATEGORY_NONE_VALUE,
    )
  })

  test.each([undefined, null, "", "0", "-1", "1.2", "abc"])(
    "カテゴリ条件に使わないURL search %s はundefinedにする",
    (categorySearch) => {
      expect(toPaymentCategorySearch(categorySearch)).toBeUndefined()
    },
  )
})
