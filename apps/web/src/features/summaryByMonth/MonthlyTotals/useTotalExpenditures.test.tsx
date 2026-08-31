import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { renderHook, waitFor } from "../../../test/test-utils"
import { fetchTotalExpenditures } from "./fetchTotalExpenditures"
import { useTotalExpenditures } from "./useTotalExpenditures"

vi.mock("./fetchTotalExpenditures", () => ({
  fetchTotalExpenditures: vi.fn(),
}))

describe("useTotalExpenditures", () => {
  beforeEach(() => {
    vi.mocked(fetchTotalExpenditures).mockReset()
  })

  test("対象月の支出合計を取得する", async () => {
    vi.mocked(fetchTotalExpenditures).mockResolvedValue(1000)

    const { result } = renderHook(() => useTotalExpenditures("2025-06"))

    await waitFor(() => {
      expect(result.current.data).toBe(1000)
    })
    expect(fetchTotalExpenditures).toHaveBeenCalledWith("2025-06")
  })
})
