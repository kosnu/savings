import { beforeEach, describe, expect, it, vi } from "vitest"

import { createQueryClient } from "../../../lib/queryClient"
import { act, renderHook } from "../../../test/test-utils"
import type { MonthlyBudgetWriteInput } from "./monthlyBudgetFormMappers"
import { useCreateMonthlyBudget } from "./useCreateMonthlyBudget"

const { mockCreateMonthlyBudget } = vi.hoisted(() => ({
  mockCreateMonthlyBudget: vi.fn(),
}))

vi.mock("./createMonthlyBudget", () => ({
  createMonthlyBudget: mockCreateMonthlyBudget,
}))

describe("useCreateMonthlyBudget", () => {
  beforeEach(() => {
    mockCreateMonthlyBudget.mockReset()
  })

  it("成功時に関連queryをinvalidateしてresolveする", async () => {
    const queryClient = createQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const input: MonthlyBudgetWriteInput = {
      targetMonth: new Date(2026, 2, 1),
      amount: 300000,
    }
    mockCreateMonthlyBudget.mockResolvedValue(undefined)

    const { result } = renderHook(() => useCreateMonthlyBudget(), {
      queryClient,
    })

    await act(async () => {
      const promise = result.current.createMonthlyBudget(input)

      expect(promise).toBeInstanceOf(Promise)
      await promise
    })

    expect(mockCreateMonthlyBudget).toHaveBeenCalledTimes(1)
    expect(mockCreateMonthlyBudget.mock.calls[0]?.[0]).toBe(input)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["monthlyBudgets"] })
    expect(invalidateQueries).toHaveBeenCalledTimes(1)
  })

  it("失敗時に関連queryをinvalidateせずrejectする", async () => {
    const queryClient = createQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const error = { message: "重複しています", code: "23505" }
    mockCreateMonthlyBudget.mockRejectedValue(error)

    const { result } = renderHook(() => useCreateMonthlyBudget(), {
      queryClient,
    })

    await act(async () => {
      await expect(
        result.current.createMonthlyBudget({
          targetMonth: new Date(2026, 2, 1),
          amount: 300000,
        }),
      ).rejects.toEqual(error)
    })

    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
