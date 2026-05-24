import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { act, createTestQueryClient, renderHook, waitFor } from "../../../test/test-utils"
import { summaryQueryKeys } from "../../summaryByMonth/queryKeys"
import { paymentQueryKeys } from "../queryKeys"
import { useDeletePayment } from "./useDeletePayment"

const { mockRemovePayment } = vi.hoisted(() => ({
  mockRemovePayment: vi.fn(),
}))

vi.mock("./removePayment", () => ({
  removePayment: mockRemovePayment,
}))

describe("useDeletePayment", () => {
  beforeEach(() => {
    mockRemovePayment.mockReset()
  })

  it("成功時に関連queryをinvalidateしてonSuccessを呼ぶ", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    const onError = vi.fn()
    mockRemovePayment.mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeletePayment(onSuccess, onError), {
      queryClient,
    })

    await act(async () => {
      const promise = result.current.deletePayment(42)

      expect(promise).toBeInstanceOf(Promise)
      await promise
    })

    expect(mockRemovePayment).toHaveBeenCalledWith(42)
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(onError).not.toHaveBeenCalled()
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: paymentQueryKeys.all })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: paymentQueryKeys.details(42) })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: summaryQueryKeys.totalExpendituresAll,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: summaryQueryKeys.categoryTotalsAll })
  })

  it("失敗時にonErrorを呼んでエラーをrethrowする", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const error = new Error("failed")
    mockRemovePayment.mockRejectedValue(error)

    const { result } = renderHook(() => useDeletePayment(onSuccess, onError), {
      queryClient,
    })

    await act(async () => {
      await expect(result.current.deletePayment(42)).rejects.toThrow("failed")
    })

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error)
    })
    expect(onSuccess).not.toHaveBeenCalled()
    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
