import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { act, createTestQueryClient, renderHook } from "../../../test/test-utils"
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
      monthlyBudgetId: 42,
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
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["monthlyBudgets"] })
    expect(invalidateQueries).toHaveBeenCalledTimes(1)
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
          monthlyBudgetId: 42,
          amount: 300000,
        }),
      ).rejects.toEqual(error)
    })

    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
