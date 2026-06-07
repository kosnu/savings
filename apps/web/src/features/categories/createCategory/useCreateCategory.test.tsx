import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { act, createTestQueryClient, renderHook } from "../../../test/test-utils"
import { summaryQueryKeys } from "../../summaryByMonth"
import { categoryQueryKeys } from "../queryKeys"
import type { CategoryCreateValues } from "./categoryCreateSchema"
import { useCreateCategory } from "./useCreateCategory"

const { mockCreateCategory } = vi.hoisted(() => ({
  mockCreateCategory: vi.fn(),
}))

vi.mock("./createCategory", () => ({
  createCategory: mockCreateCategory,
}))

describe("useCreateCategory", () => {
  beforeEach(() => {
    mockCreateCategory.mockReset()
  })

  it("成功時にカテゴリqueryをinvalidateしてresolveする", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const input: CategoryCreateValues = {
      budgetAmount: null,
      name: "Groceries",
      pinned: false,
    }
    mockCreateCategory.mockResolvedValue(40)

    const { result } = renderHook(() => useCreateCategory(), {
      queryClient,
    })

    await act(async () => {
      const promise = result.current.createCategory(input)

      expect(promise).toBeInstanceOf(Promise)
      await expect(promise).resolves.toBe(40)
    })

    expect(mockCreateCategory).toHaveBeenCalledTimes(1)
    expect(mockCreateCategory.mock.calls[0]?.[0]).toBe(input)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: categoryQueryKeys.all })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: summaryQueryKeys.categoryTotalsAll })
    expect(invalidateQueries).toHaveBeenCalledTimes(2)
  })

  it("失敗時にqueryをinvalidateせずrejectする", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const error = { message: "作成に失敗しました" }
    mockCreateCategory.mockRejectedValue(error)

    const { result } = renderHook(() => useCreateCategory(), {
      queryClient,
    })

    await act(async () => {
      await expect(
        result.current.createCategory({ budgetAmount: null, name: "Groceries", pinned: false }),
      ).rejects.toEqual(error)
    })

    expect(invalidateQueries).not.toHaveBeenCalled()
  })

  it("pinned true の場合も作成RPCに値を渡す", async () => {
    const queryClient = createTestQueryClient()
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined)
    const input: CategoryCreateValues = {
      budgetAmount: 0,
      name: "Groceries",
      pinned: true,
    }
    mockCreateCategory.mockResolvedValue(40)

    const { result } = renderHook(() => useCreateCategory(), {
      queryClient,
    })

    await act(async () => {
      await expect(result.current.createCategory(input)).resolves.toBe(40)
    })

    expect(mockCreateCategory).toHaveBeenCalledWith(input)
  })
})
