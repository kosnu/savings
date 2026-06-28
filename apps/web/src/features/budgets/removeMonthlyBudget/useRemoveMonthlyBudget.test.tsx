import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { act, createTestQueryClient, renderHook } from "../../../test/test-utils"
import { monthlyBudgetQueryKeys } from "../queryKeys"
import { useRemoveMonthlyBudget } from "./useRemoveMonthlyBudget"

const { mockRemoveMonthlyBudget } = vi.hoisted(() => ({
  mockRemoveMonthlyBudget: vi.fn(),
}))

vi.mock("./removeMonthlyBudget", () => ({
  removeCurrentMonthlyBudget: mockRemoveMonthlyBudget,
}))

describe("useRemoveMonthlyBudget", () => {
  beforeEach(() => {
    mockRemoveMonthlyBudget.mockReset()
  })

  it("成功時にmonthlyBudgets queryをinvalidateしてresolveする", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    mockRemoveMonthlyBudget.mockResolvedValue(undefined)

    const { result } = renderHook(() => useRemoveMonthlyBudget(), {
      queryClient,
    })

    await act(async () => {
      const promise = result.current.removeMonthlyBudget()

      expect(promise).toBeInstanceOf(Promise)
      await promise
    })

    expect(mockRemoveMonthlyBudget).toHaveBeenCalledTimes(1)
    expect(mockRemoveMonthlyBudget.mock.calls[0]?.[0]).toBeUndefined()
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: monthlyBudgetQueryKeys.listAll })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: monthlyBudgetQueryKeys.effectiveAll,
    })
    expect(invalidateQueries).toHaveBeenCalledTimes(2)
  })

  it("失敗時にmonthlyBudgets queryをinvalidateせずrejectする", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const error = { message: "削除に失敗しました", code: "42501" }
    mockRemoveMonthlyBudget.mockRejectedValue(error)

    const { result } = renderHook(() => useRemoveMonthlyBudget(), {
      queryClient,
    })

    await act(async () => {
      await expect(result.current.removeMonthlyBudget()).rejects.toEqual(error)
    })

    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
