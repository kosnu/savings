import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { renderHook, waitFor } from "../../../test/test-utils"
import type { MonthlyBudget } from "../types"
import { useMonthlyBudgets } from "./useMonthlyBudgets"

const { mockFetchMonthlyBudgets } = vi.hoisted(() => ({
  mockFetchMonthlyBudgets: vi.fn(),
}))

vi.mock("./fetchMonthlyBudgets", () => ({
  fetchMonthlyBudgets: mockFetchMonthlyBudgets,
}))

function buildMonthlyBudget(id: number): MonthlyBudget {
  return {
    id,
    bookId: 1,
    amount: 50000 + id,
    effectiveFrom: new Date(2025, id, 1),
    effectiveYear: 2025,
    effectiveMonth: id + 1,
    status: "amount",
    createdDate: new Date("2025-01-01T00:00:00.000Z"),
    updatedDate: new Date("2025-01-01T00:00:00.000Z"),
  }
}

describe("useMonthlyBudgets", () => {
  beforeEach(() => {
    mockFetchMonthlyBudgets.mockReset()
  })

  it("指定した件数で月予算一覧を取得する", async () => {
    const budgets = [buildMonthlyBudget(1), buildMonthlyBudget(2)]
    mockFetchMonthlyBudgets.mockResolvedValue(budgets)

    const { result } = renderHook(() => useMonthlyBudgets(10))

    await waitFor(() => {
      expect(result.current.data).toEqual(budgets)
    })
    expect(mockFetchMonthlyBudgets).toHaveBeenCalledWith(10)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("取得件数が変わると別 query として取得し直す", async () => {
    const firstBudget = buildMonthlyBudget(1)
    const secondBudget = buildMonthlyBudget(2)
    mockFetchMonthlyBudgets
      .mockResolvedValueOnce([firstBudget])
      .mockResolvedValueOnce([secondBudget])

    const { result, rerender } = renderHook(
      ({ limit }: { limit: number }) => useMonthlyBudgets(limit),
      {
        initialProps: { limit: 10 },
      },
    )

    await waitFor(() => {
      expect(result.current.data).toEqual([firstBudget])
    })

    rerender({ limit: 3 })

    await waitFor(() => {
      expect(result.current.data).toEqual([secondBudget])
    })
    expect(mockFetchMonthlyBudgets).toHaveBeenNthCalledWith(1, 10)
    expect(mockFetchMonthlyBudgets).toHaveBeenNthCalledWith(2, 3)
  })

  it("取得に失敗した場合は error を返す", async () => {
    const error = new Error("failed")
    mockFetchMonthlyBudgets.mockRejectedValue(error)

    const { result } = renderHook(() => useMonthlyBudgets(10))

    await waitFor(() => {
      expect(result.current.error).toBe(error)
    })
    expect(result.current.data).toEqual([])
    expect(result.current.loading).toBe(false)
  })
})
