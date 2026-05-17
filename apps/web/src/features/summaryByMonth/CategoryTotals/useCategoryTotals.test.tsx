import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { renderHook, waitFor } from "../../../test/test-utils"
import { fetchCategoryTotals } from "./fetchCategoryTotals"
import { useCategoryTotals } from "./useCategoryTotals"

const dateRangeState = vi.hoisted<{
  date: Date | null
  dateRange: [Date | null, Date | null]
}>(() => ({
  date: new Date(2025, 5, 1),
  dateRange: [new Date(2025, 5, 1), new Date(2025, 5, 30)] as [Date | null, Date | null],
}))

vi.mock("../../../utils/useDateRange", () => ({
  useDateRange: () => dateRangeState,
}))

vi.mock("./fetchCategoryTotals", () => ({
  fetchCategoryTotals: vi.fn(),
}))

describe("useCategoryTotals", () => {
  beforeEach(() => {
    dateRangeState.date = new Date(2025, 5, 1)
    dateRangeState.dateRange = [new Date(2025, 5, 1), new Date(2025, 5, 30)]
    vi.mocked(fetchCategoryTotals).mockReset()
  })

  test("カテゴリ別月合計額を取得する", async () => {
    const totals = { Food: 1000 }
    vi.mocked(fetchCategoryTotals).mockResolvedValue(totals)

    const { result } = renderHook(() => useCategoryTotals({ cacheScope: "payments-page-1" }))

    await waitFor(() => {
      expect(result.current.categoryTotals).toEqual(totals)
    })
    expect(fetchCategoryTotals).toHaveBeenCalledWith(dateRangeState.dateRange)
  })

  test("同じcacheScopeと月ではqueryを再利用する", async () => {
    const totals = { Food: 1000 }
    vi.mocked(fetchCategoryTotals).mockResolvedValue(totals)

    const { result, rerender } = renderHook(
      ({ cacheScope }: { cacheScope: string }) => useCategoryTotals({ cacheScope }),
      {
        initialProps: { cacheScope: "payments-page-1" },
      },
    )

    await waitFor(() => {
      expect(result.current.categoryTotals).toEqual(totals)
    })

    rerender({ cacheScope: "payments-page-1" })

    await waitFor(() => {
      expect(result.current.categoryTotals).toEqual(totals)
    })
    expect(fetchCategoryTotals).toHaveBeenCalledTimes(1)
  })

  test("cacheScopeが変わると別queryとして取得し直す", async () => {
    vi.mocked(fetchCategoryTotals)
      .mockResolvedValueOnce({ Food: 1000 })
      .mockResolvedValueOnce({ Food: 2000 })

    const { result, rerender } = renderHook(
      ({ cacheScope }: { cacheScope: string }) => useCategoryTotals({ cacheScope }),
      {
        initialProps: { cacheScope: "payments-page-1" },
      },
    )

    await waitFor(() => {
      expect(result.current.categoryTotals).toEqual({ Food: 1000 })
    })

    rerender({ cacheScope: "payments-page-2" })

    await waitFor(() => {
      expect(result.current.categoryTotals).toEqual({ Food: 2000 })
    })
    expect(fetchCategoryTotals).toHaveBeenCalledTimes(2)
  })

  test("同じcacheScopeでも月が変わると別queryとして取得し直す", async () => {
    vi.mocked(fetchCategoryTotals)
      .mockResolvedValueOnce({ Food: 1000 })
      .mockResolvedValueOnce({ Food: 2000 })

    const { result, rerender } = renderHook(() =>
      useCategoryTotals({ cacheScope: "payments-page-1" }),
    )

    await waitFor(() => {
      expect(result.current.categoryTotals).toEqual({ Food: 1000 })
    })

    dateRangeState.date = new Date(2025, 6, 1)
    dateRangeState.dateRange = [new Date(2025, 6, 1), new Date(2025, 6, 31)]
    rerender()

    await waitFor(() => {
      expect(result.current.categoryTotals).toEqual({ Food: 2000 })
    })
    expect(fetchCategoryTotals).toHaveBeenCalledTimes(2)
  })

  test("年月が未確定なら取得しない", async () => {
    dateRangeState.date = null
    dateRangeState.dateRange = [null, null]

    const { result } = renderHook(() => useCategoryTotals({ cacheScope: "payments-page-1" }))

    expect(result.current.categoryTotals).toEqual({})
    expect(fetchCategoryTotals).not.toHaveBeenCalled()
  })
})
