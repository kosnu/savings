import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { renderHook, waitFor } from "../../../test/test-utils"
import { fetchTotalExpenditures } from "./fetchTotalExpenditures"
import { useTotalExpenditures } from "./useTotalExpenditures"

const dateRangeState = vi.hoisted<{
  date: Date | null
}>(() => ({
  date: new Date(2025, 5, 1),
}))

vi.mock("../../../utils/useDateRange", () => ({
  useDateRange: () => dateRangeState,
}))

vi.mock("./fetchTotalExpenditures", () => ({
  fetchTotalExpenditures: vi.fn(),
}))

describe("useTotalExpenditures", () => {
  beforeEach(() => {
    dateRangeState.date = new Date(2025, 5, 1)
    vi.mocked(fetchTotalExpenditures).mockReset()
  })

  test("対象月の支出合計を取得する", async () => {
    vi.mocked(fetchTotalExpenditures).mockResolvedValue(1000)

    const { result } = renderHook(() => useTotalExpenditures())

    await waitFor(() => {
      expect(result.current.data).toBe(1000)
    })
    expect(fetchTotalExpenditures).toHaveBeenCalledWith("2025-06")
  })

  test("年月が未確定なら取得しない", () => {
    dateRangeState.date = null

    const { result } = renderHook(() => useTotalExpenditures())

    expect(result.current.data).toBeNull()
    expect(fetchTotalExpenditures).not.toHaveBeenCalled()
  })
})
