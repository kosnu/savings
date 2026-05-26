import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { act, createTestQueryClient, renderHook } from "../../../test/test-utils"
import { summaryQueryKeys } from "../../summaryByMonth/queryKeys"
import { categoryQueryKeys } from "../queryKeys"
import { useUpdateCategory } from "./useUpdateCategory"

const { mockUpdateCategory } = vi.hoisted(() => ({
  mockUpdateCategory: vi.fn(),
}))

vi.mock("./updateCategory", () => ({
  updateCategory: mockUpdateCategory,
}))

describe("useUpdateCategory", () => {
  beforeEach(() => {
    mockUpdateCategory.mockReset()
  })

  it("成功時にカテゴリ作成と同じqueryをinvalidateしてresolveする", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const input = {
      categoryId: 10,
      name: "Groceries",
      categoryBudgetId: 30,
      budgetAmount: 50000,
    }
    mockUpdateCategory.mockResolvedValue(undefined)

    const { result } = renderHook(() => useUpdateCategory(), {
      queryClient,
    })

    await act(async () => {
      const promise = result.current.updateCategory(input)

      expect(promise).toBeInstanceOf(Promise)
      await promise
    })

    expect(mockUpdateCategory).toHaveBeenCalledTimes(1)
    expect(mockUpdateCategory.mock.calls[0]?.[0]).toBe(input)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: categoryQueryKeys.all })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: summaryQueryKeys.categoryTotalsAll })
    expect(invalidateQueries).toHaveBeenCalledTimes(2)
  })

  it("失敗時にqueryをinvalidateせずrejectする", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const error = { message: "更新に失敗しました", code: "42501" }
    mockUpdateCategory.mockRejectedValue(error)

    const { result } = renderHook(() => useUpdateCategory(), {
      queryClient,
    })

    await act(async () => {
      await expect(
        result.current.updateCategory({
          categoryId: 10,
          name: "Groceries",
          categoryBudgetId: 30,
          budgetAmount: 50000,
        }),
      ).rejects.toEqual(error)
    })

    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
