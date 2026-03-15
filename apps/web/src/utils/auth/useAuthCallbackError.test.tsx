import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { useAuthCallbackError } from "./useAuthCallbackError"

const { mockCaptureAuthCallbackError } = vi.hoisted(() => ({
  mockCaptureAuthCallbackError: vi.fn(),
}))

vi.mock("../../lib/sentry", () => ({
  captureAuthCallbackError: mockCaptureAuthCallbackError,
}))

describe("useAuthCallbackError", () => {
  beforeEach(() => {
    mockCaptureAuthCallbackError.mockReset()
  })

  test("認証エラーを抽出してSentryに送信する", () => {
    const url =
      "http://localhost:5173/auth?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+abc"
    const { result } = renderHook(() => useAuthCallbackError(url))

    expect(result.current).toEqual({
      code: "unexpected_failure",
      description: "Unable to exchange external code: abc",
    })
    expect(mockCaptureAuthCallbackError).toHaveBeenCalledWith({
      code: "unexpected_failure",
      description: "Unable to exchange external code: abc",
    })
  })

  test("同じURLで再レンダーしてもSentryに重複送信しない", () => {
    const url =
      "http://localhost:5173/auth?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+abc"
    const { rerender } = renderHook(() => useAuthCallbackError(url))
    rerender()

    expect(mockCaptureAuthCallbackError).toHaveBeenCalledTimes(1)
  })

  test("認証エラーがない場合はnullを返して送信しない", () => {
    const { result } = renderHook(() => useAuthCallbackError("http://localhost:5173/auth"))

    expect(result.current).toBeNull()
    expect(mockCaptureAuthCallbackError).not.toHaveBeenCalled()
  })
})
