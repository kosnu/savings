import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { act, createTestQueryClient, renderHook } from "../../../test/test-utils"
import { categoryQueryKeys } from "../queryKeys"
import { useUpdateCategoryName } from "./useUpdateCategoryName"

const { mockUpdateCategoryName } = vi.hoisted(() => ({
  mockUpdateCategoryName: vi.fn(),
}))

vi.mock("./updateCategoryName", () => ({
  updateCategoryName: mockUpdateCategoryName,
}))

describe("useUpdateCategoryName", () => {
  beforeEach(() => {
    mockUpdateCategoryName.mockReset()
  })

  it("成功時にカテゴリqueryをinvalidateしてresolveする", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const input = {
      categoryId: 10,
      name: "Groceries",
    }
    mockUpdateCategoryName.mockResolvedValue(undefined)

    const { result } = renderHook(() => useUpdateCategoryName(), {
      queryClient,
    })

    await act(async () => {
      const promise = result.current.updateCategoryName(input)

      expect(promise).toBeInstanceOf(Promise)
      await promise
    })

    expect(mockUpdateCategoryName).toHaveBeenCalledTimes(1)
    expect(mockUpdateCategoryName.mock.calls[0]?.[0]).toBe(input)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: categoryQueryKeys.all })
    expect(invalidateQueries).toHaveBeenCalledTimes(1)
  })

  it("失敗時にqueryをinvalidateせずrejectする", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const error = { message: "更新に失敗しました", code: "42501" }
    mockUpdateCategoryName.mockRejectedValue(error)

    const { result } = renderHook(() => useUpdateCategoryName(), {
      queryClient,
    })

    await act(async () => {
      await expect(
        result.current.updateCategoryName({
          categoryId: 10,
          name: "Groceries",
        }),
      ).rejects.toEqual(error)
    })

    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
