import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { act, createTestQueryClient, renderHook } from "../../../test/test-utils"
import { monthlyBudgetQueryKeys } from "../queryKeys"
import { useUpdateMonthlyBudget } from "./useUpdateMonthlyBudget"

const { mockUpdateMonthlyBudget } = vi.hoisted(() => ({
  mockUpdateMonthlyBudget: vi.fn(),
}))

vi.mock("./updateMonthlyBudget", () => ({
  updateMonthlyBudget: mockUpdateMonthlyBudget,
}))

describe("useUpdateMonthlyBudget", () => {
  beforeEach(() => {
    mockUpdateMonthlyBudget.mockReset()
  })

  it("成功時にmonthlyBudgets queryをinvalidateしてresolveする", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const input = {
      targetMonth: new Date(2026, 2, 1),
      amount: 300000,
    }
    mockUpdateMonthlyBudget.mockResolvedValue(undefined)

    const { result } = renderHook(() => useUpdateMonthlyBudget(), {
      queryClient,
    })

    await act(async () => {
      const promise = result.current.updateMonthlyBudget(input)

      expect(promise).toBeInstanceOf(Promise)
      await promise
    })

    expect(mockUpdateMonthlyBudget).toHaveBeenCalledTimes(1)
    expect(mockUpdateMonthlyBudget.mock.calls[0]?.[0]).toBe(input)
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
    const error = { message: "更新に失敗しました", code: "42501" }
    mockUpdateMonthlyBudget.mockRejectedValue(error)

    const { result } = renderHook(() => useUpdateMonthlyBudget(), {
      queryClient,
    })

    await act(async () => {
      await expect(
        result.current.updateMonthlyBudget({
          targetMonth: new Date(2026, 2, 1),
          amount: 300000,
        }),
      ).rejects.toEqual(error)
    })

    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
