import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { act, createTestQueryClient, renderHook, waitFor } from "../../../test/test-utils"
import { summaryQueryKeys } from "../../summaryByMonth"
import { paymentQueryKeys } from "../queryKeys"
import { useUpdatePayment } from "./useUpdatePayment"

const { mockUpdatePayment } = vi.hoisted(() => ({
  mockUpdatePayment: vi.fn(),
}))

vi.mock("./updatePayment", () => ({
  updatePayment: mockUpdatePayment,
}))

describe("useUpdatePayment", () => {
  beforeEach(() => {
    mockUpdatePayment.mockReset()
  })

  it("成功時に関連queryをinvalidateしてonSuccessを呼ぶ", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    const onError = vi.fn()
    mockUpdatePayment.mockResolvedValue(undefined)

    const { result } = renderHook(() => useUpdatePayment(1, onSuccess, onError), {
      queryClient,
    })

    await act(async () => {
      const promise = result.current.updatePayment({
        paymentId: 42,
        patch: { amount: 1080 },
      })

      expect(promise).toBeInstanceOf(Promise)
      await promise
    })

    expect(mockUpdatePayment).toHaveBeenCalledWith(1, 42, { amount: 1080 })
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(onError).not.toHaveBeenCalled()
    expect(invalidateQueries).toHaveBeenCalledWith(
      { queryKey: paymentQueryKeys.book(1) },
      { throwOnError: true },
    )
    expect(invalidateQueries).toHaveBeenCalledWith(
      { queryKey: paymentQueryKeys.detailsBook(1) },
      { throwOnError: true },
    )
    expect(invalidateQueries).toHaveBeenCalledWith(
      { queryKey: summaryQueryKeys.totalExpendituresAll },
      { throwOnError: true },
    )
    expect(invalidateQueries).toHaveBeenCalledWith(
      { queryKey: summaryQueryKeys.categoryTotalsAll },
      { throwOnError: true },
    )
  })

  it("refetch失敗時にonErrorを呼んで更新成功扱いにしない", async () => {
    const queryClient = createTestQueryClient()
    const refetchError = new Error("refetch failed")
    vi.spyOn(queryClient, "invalidateQueries")
      .mockRejectedValueOnce(refetchError)
      .mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    const onError = vi.fn()
    mockUpdatePayment.mockResolvedValue(undefined)

    const { result } = renderHook(() => useUpdatePayment(1, onSuccess, onError), {
      queryClient,
    })

    await act(async () => {
      await expect(
        result.current.updatePayment({
          paymentId: 42,
          patch: { amount: 1080 },
        }),
      ).rejects.toThrow(refetchError)
    })

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(refetchError)
    })
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("失敗時にonErrorを呼んでエラーをrethrowする", async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const error = new Error("failed")
    mockUpdatePayment.mockRejectedValue(error)

    const { result } = renderHook(() => useUpdatePayment(1, onSuccess, onError), {
      queryClient,
    })

    await act(async () => {
      await expect(
        result.current.updatePayment({
          paymentId: 42,
          patch: { note: "updated" },
        }),
      ).rejects.toThrow("failed")
    })

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error)
    })
    expect(onSuccess).not.toHaveBeenCalled()
    expect(invalidateQueries).not.toHaveBeenCalled()
  })

  it("プレーンオブジェクトのエラーもonErrorへそのまま渡す", async () => {
    const queryClient = createTestQueryClient()
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const error = { message: "failed", code: "PGRST301" }
    mockUpdatePayment.mockRejectedValue(error)

    const { result } = renderHook(() => useUpdatePayment(1, onSuccess, onError), {
      queryClient,
    })

    await act(async () => {
      await expect(
        result.current.updatePayment({
          paymentId: 42,
          patch: { note: "updated" },
        }),
      ).rejects.toEqual(error)
    })

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error)
    })
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
