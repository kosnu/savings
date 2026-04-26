import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { renderHook, waitFor } from "../../../test/test-utils"
import type { CategoryBudget } from "../types"
import { useCategoryBudgets } from "./useCategoryBudgets"

const { mockFetchCategoryBudgets } = vi.hoisted(() => ({
  mockFetchCategoryBudgets: vi.fn(),
}))

vi.mock("./fetchCategoryBudgets", () => ({
  fetchCategoryBudgets: mockFetchCategoryBudgets,
}))

function buildCategoryBudget(id: number): CategoryBudget {
  return {
    id,
    amount: 50000 + id,
    categoryId: 10 + id,
    categoryName: `Category ${id}`,
    effectiveFrom: new Date(2025, id, 1),
    effectiveYear: 2025,
    effectiveMonth: id + 1,
    userId: 100,
    createdDate: new Date("2025-01-01T00:00:00.000Z"),
    updatedDate: new Date("2025-01-01T00:00:00.000Z"),
  }
}

describe("useCategoryBudgets", () => {
  beforeEach(() => {
    mockFetchCategoryBudgets.mockReset()
  })

  it("カテゴリ別予算一覧を取得する", async () => {
    const budgets = [buildCategoryBudget(1), buildCategoryBudget(2)]
    mockFetchCategoryBudgets.mockResolvedValue(budgets)

    const { result } = renderHook(() => useCategoryBudgets())

    await waitFor(() => {
      expect(result.current.data).toEqual(budgets)
    })
    expect(mockFetchCategoryBudgets).toHaveBeenCalledTimes(1)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("取得に失敗した場合は error を返す", async () => {
    const error = new Error("failed")
    mockFetchCategoryBudgets.mockRejectedValue(error)

    const { result } = renderHook(() => useCategoryBudgets())

    await waitFor(
      () => {
        expect(result.current.error).toBe(error)
      },
      { timeout: 3000 },
    )
    expect(result.current.data).toEqual([])
    expect(result.current.loading).toBe(false)
  })
})
