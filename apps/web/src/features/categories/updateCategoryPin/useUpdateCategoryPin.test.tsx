import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { act, createTestQueryClient, renderHook } from "../../../test/test-utils"
import { summaryQueryKeys } from "../../summaryByMonth/queryKeys"
import { categoryQueryKeys } from "../queryKeys"
import { useUpdateCategoryPin } from "./useUpdateCategoryPin"

const { mockUpdateCategoryPin } = vi.hoisted(() => ({
  mockUpdateCategoryPin: vi.fn(),
}))

vi.mock("./updateCategoryPin", () => ({
  updateCategoryPin: mockUpdateCategoryPin,
}))

describe("useUpdateCategoryPin", () => {
  beforeEach(() => {
    mockUpdateCategoryPin.mockReset()
  })

  it("成功時にカテゴリqueryとカテゴリ別サマリーqueryをinvalidateしてresolveする", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const input = {
      categoryId: 10,
      pinned: true,
    }
    mockUpdateCategoryPin.mockResolvedValue(undefined)

    const { result } = renderHook(() => useUpdateCategoryPin(), {
      queryClient,
    })

    await act(async () => {
      const promise = result.current.updateCategoryPin(input)

      expect(promise).toBeInstanceOf(Promise)
      await promise
    })

    expect(mockUpdateCategoryPin).toHaveBeenCalledTimes(1)
    expect(mockUpdateCategoryPin.mock.calls[0]?.[0]).toBe(input)
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
    mockUpdateCategoryPin.mockRejectedValue(error)

    const { result } = renderHook(() => useUpdateCategoryPin(), {
      queryClient,
    })

    await act(async () => {
      await expect(
        result.current.updateCategoryPin({ categoryId: 10, pinned: true }),
      ).rejects.toEqual(error)
    })

    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
