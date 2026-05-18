import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createTestQueryClient, renderHook, waitFor } from "../../../test/test-utils"
import { useCreatePayment } from "./useCreatePayment"

const { mockFrom, mockInsert } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

describe("useCreatePayment", () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockReset()
  })

  it("成功時に関連queryをinvalidateしてonSuccessを呼ぶ", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    const onError = vi.fn()
    mockInsert.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useCreatePayment(onSuccess, onError), {
      queryClient,
    })

    result.current.createPayment({
      date: new Date(2025, 5, 1),
      categoryId: "10",
      note: "lunch",
      amount: 1000,
    })

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(onError).not.toHaveBeenCalled()
    expect(mockFrom).toHaveBeenCalledWith("payments")
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["payments"] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["totalExpenditures"] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["categoryTotals"] })
  })

  it("失敗時にonErrorを呼んでinvalidateしない", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const error = new Error("failed")
    mockInsert.mockResolvedValue({ error })

    const { result } = renderHook(() => useCreatePayment(onSuccess, onError), {
      queryClient,
    })

    result.current.createPayment({
      date: new Date(2025, 5, 1),
      categoryId: "10",
      note: "lunch",
      amount: 1000,
    })

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error)
    })
    expect(onSuccess).not.toHaveBeenCalled()
    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
