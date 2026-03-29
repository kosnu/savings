import { QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { PropsWithChildren } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createQueryClient } from "../../../lib/queryClient"
import { useUpdatePayment } from "./useUpdatePayment"

const { mockUpdatePayment } = vi.hoisted(() => ({
  mockUpdatePayment: vi.fn(),
}))

vi.mock("./updatePayment", () => ({
  updatePayment: mockUpdatePayment,
}))

function createWrapper(queryClient: ReturnType<typeof createQueryClient>) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("useUpdatePayment", () => {
  beforeEach(() => {
    mockUpdatePayment.mockReset()
  })

  it("成功時に関連queryをinvalidateしてonSuccessを呼ぶ", async () => {
    const queryClient = createQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    const onError = vi.fn()
    mockUpdatePayment.mockResolvedValue(undefined)

    const { result } = renderHook(() => useUpdatePayment(onSuccess, onError), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      const promise = result.current.updatePayment({
        paymentId: 42,
        patch: { amount: 1080 },
      })

      expect(promise).toBeInstanceOf(Promise)
      await promise
    })

    expect(mockUpdatePayment).toHaveBeenCalledWith(42, { amount: 1080 })
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(onError).not.toHaveBeenCalled()
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["payments"] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["totalExpenditures"] })
  })

  it("失敗時にonErrorを呼んでエラーをrethrowする", async () => {
    const queryClient = createQueryClient()
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const error = new Error("failed")
    mockUpdatePayment.mockRejectedValue(error)

    const { result } = renderHook(() => useUpdatePayment(onSuccess, onError), {
      wrapper: createWrapper(queryClient),
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
})
