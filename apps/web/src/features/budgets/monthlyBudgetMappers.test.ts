import { describe, expect, test } from "vite-plus/test"

import { monthlyBudgets } from "../../test/data/monthlyBudgets"
import {
  normalizeEffectiveMonthlyBudgetResponse,
  toMonthlyBudget,
  toMonthlyBudgetState,
} from "./monthlyBudgetMappers"

describe("monthlyBudgetMappers", () => {
  test("0円の月予算は amount 状態として扱う", () => {
    const state = toMonthlyBudgetState(
      normalizeEffectiveMonthlyBudgetResponse({
        status: "amount",
        monthly_budget: {
          ...monthlyBudgets[2],
          amount: 0,
        },
      }),
    )

    expect(state).toEqual({
      status: "amount",
      monthlyBudget: expect.objectContaining({
        amount: 0,
        status: "amount",
      }),
    })
  })

  test("予算なし状態は amount に変換しない", () => {
    const state = toMonthlyBudgetState(
      normalizeEffectiveMonthlyBudgetResponse({
        status: "none",
        monthly_budget: null,
      }),
    )

    expect(state).toEqual({ status: "none", monthlyBudget: null })
  })

  test("none row は月予算 domain model に変換しない", () => {
    expect(() =>
      toMonthlyBudget({
        ...monthlyBudgets[2],
        amount: null,
        status: "none",
      }),
    ).toThrow("Invalid monthly budget response")
  })
})
