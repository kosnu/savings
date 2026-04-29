import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createQueryClient } from "../../../lib/queryClient"
import { act, renderHook } from "../../../test/test-utils"
import type { CategoryBudgetWriteInput } from "./categoryBudgetFormMappers"
import { useCreateCategoryBudget } from "./useCreateCategoryBudget"

const { mockCreateCategoryBudget } = vi.hoisted(() => ({
  mockCreateCategoryBudget: vi.fn(),
}))

vi.mock("./createCategoryBudget", () => ({
  createCategoryBudget: mockCreateCategoryBudget,
}))

describe("useCreateCategoryBudget", () => {
  beforeEach(() => {
    mockCreateCategoryBudget.mockReset()
  })

  it("成功時に関連queryをinvalidateしてresolveする", async () => {
    const queryClient = createQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const input: CategoryBudgetWriteInput = {
      categoryId: 10,
      targetMonth: new Date(2026, 2, 1),
      amount: 50000,
    }
    mockCreateCategoryBudget.mockResolvedValue(undefined)

    const { result } = renderHook(() => useCreateCategoryBudget(), {
      queryClient,
    })

    await act(async () => {
      const promise = result.current.createCategoryBudget(input)

      expect(promise).toBeInstanceOf(Promise)
      await promise
    })

    expect(mockCreateCategoryBudget).toHaveBeenCalledTimes(1)
    expect(mockCreateCategoryBudget.mock.calls[0]?.[0]).toBe(input)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["categoryBudgets"] })
    expect(invalidateQueries).toHaveBeenCalledTimes(1)
  })

  it("失敗時に関連queryをinvalidateせずrejectする", async () => {
    const queryClient = createQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const error = { message: "重複しています", code: "23505" }
    mockCreateCategoryBudget.mockRejectedValue(error)

    const { result } = renderHook(() => useCreateCategoryBudget(), {
      queryClient,
    })

    await act(async () => {
      await expect(
        result.current.createCategoryBudget({
          categoryId: 10,
          targetMonth: new Date(2026, 2, 1),
          amount: 50000,
        }),
      ).rejects.toEqual(error)
    })

    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
