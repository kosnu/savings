import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { categories } from "../../../test/data/categories"
import { act, createTestQueryClient, renderHook } from "../../../test/test-utils"
import { paymentQueryKeys } from "../../payments/queryKeys"
import { summaryQueryKeys } from "../../summaryByMonth/queryKeys"
import { categoryQueryKeys } from "../queryKeys"
import { useDeleteCategory } from "./useDeleteCategory"

const { mockDeleteCategory } = vi.hoisted(() => ({
  mockDeleteCategory: vi.fn(),
}))

vi.mock("./deleteCategory", () => ({
  deleteCategory: mockDeleteCategory,
}))

describe("useDeleteCategory", () => {
  beforeEach(() => {
    mockDeleteCategory.mockReset()
  })

  it("成功時に関連queryをinvalidateしてresolveする", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    mockDeleteCategory.mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeleteCategory(), {
      queryClient,
    })

    await act(async () => {
      const promise = result.current.deleteCategory(10)

      expect(promise).toBeInstanceOf(Promise)
      await promise
    })

    expect(mockDeleteCategory).toHaveBeenCalledWith(10)
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: categoryQueryKeys.all,
      refetchType: "all",
    })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: paymentQueryKeys.all })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: paymentQueryKeys.detailsAll })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: summaryQueryKeys.categoryTotalsAll })
    expect(invalidateQueries).toHaveBeenCalledTimes(4)
  })

  it("成功時にinactiveなカテゴリ一覧queryをrefetchする", async () => {
    const queryClient = createTestQueryClient()
    const refetchCategories = vi
      .fn()
      .mockResolvedValueOnce(categories)
      .mockResolvedValueOnce(categories.filter((category) => category.id !== 10))
    await queryClient.prefetchQuery({
      queryKey: categoryQueryKeys.list,
      queryFn: refetchCategories,
    })
    mockDeleteCategory.mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeleteCategory(), {
      queryClient,
    })

    await act(async () => {
      await result.current.deleteCategory(10)
    })

    expect(refetchCategories).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData(categoryQueryKeys.list)).toEqual(
      categories.filter((category) => category.id !== 10),
    )
  })

  it("失敗時にqueryをinvalidateせずrejectする", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const error = { message: "削除に失敗しました", code: "42501" }
    mockDeleteCategory.mockRejectedValue(error)

    const { result } = renderHook(() => useDeleteCategory(), {
      queryClient,
    })

    await act(async () => {
      await expect(result.current.deleteCategory(10)).rejects.toEqual(error)
    })

    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
