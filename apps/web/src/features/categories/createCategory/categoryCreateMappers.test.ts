import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import {
  mapCategoryCreateValuesToCategoryCreateInput,
  toCategoryCreateRpcArgs,
} from "./categoryCreateMappers"

describe("mapCategoryCreateValuesToCategoryCreateInput", () => {
  test("カテゴリ名だけの作成入力に変換する", () => {
    expect(
      mapCategoryCreateValuesToCategoryCreateInput({
        name: "Groceries",
        budgetAmount: undefined,
      }),
    ).toEqual({
      name: "Groceries",
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("月予算金額つきの場合は今月月初を補完する", () => {
    const march20 = new Date(2026, 2, 20, 12, 34, 56)
    const march1 = new Date(2026, 2, 1)

    vi.useFakeTimers()
    vi.setSystemTime(march20)

    expect(
      mapCategoryCreateValuesToCategoryCreateInput({
        name: "Groceries",
        budgetAmount: 50000,
      }),
    ).toEqual({
      name: "Groceries",
      budget: {
        targetMonth: march1,
        amount: 50000,
      },
    })
  })
})

describe("toCategoryCreateRpcArgs", () => {
  test("月予算なしの場合は予算引数を省略する", () => {
    expect(toCategoryCreateRpcArgs({ name: "Groceries" })).toEqual({
      p_category_name: "Groceries",
    })
  })

  test("月予算ありの場合は月初日のRPC引数に変換する", () => {
    const march20 = new Date(2026, 2, 20)

    expect(
      toCategoryCreateRpcArgs({
        name: "Groceries",
        budget: {
          targetMonth: march20,
          amount: 50000,
        },
      }),
    ).toEqual({
      p_category_name: "Groceries",
      p_budget_effective_from: "2026-03-01",
      p_budget_amount: 50000,
    })
  })
})
