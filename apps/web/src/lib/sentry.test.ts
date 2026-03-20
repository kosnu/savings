import { describe, expect, test, vi } from "vitest"

import { captureAuthCallbackError, captureSupabaseSessionError } from "./sentry"

const { mockCaptureMessage, mockSetContext, mockSetTag, mockWithScope } = vi.hoisted(() => {
  const mockSetContext = vi.fn()
  const mockSetTag = vi.fn()
  const mockCaptureMessage = vi.fn()
  const mockWithScope = vi.fn((callback: (scope: object) => void) => {
    callback({
      setContext: mockSetContext,
      setTag: mockSetTag,
    })
  })

  return {
    mockCaptureMessage,
    mockSetContext,
    mockSetTag,
    mockWithScope,
  }
})

vi.mock("@sentry/react", () => ({
  captureMessage: mockCaptureMessage,
  init: vi.fn(),
  withScope: mockWithScope,
}))

describe("captureAuthCallbackError", () => {
  test("Sentry には機微情報を含む description を送らない", () => {
    captureAuthCallbackError({
      code: "unexpected_failure",
      description: "Unable to exchange external code: secret-code",
    })

    expect(mockSetTag).toHaveBeenCalledWith("feature", "auth")
    expect(mockSetContext).toHaveBeenCalledWith("auth_callback_error", {
      code: "unexpected_failure",
    })
    expect(mockCaptureMessage).toHaveBeenCalledWith("Authentication callback failed", "error")
  })
})

describe("captureSupabaseSessionError", () => {
  test("Sentry にセッション取得失敗を送る", () => {
    captureSupabaseSessionError(new Error("network error"))

    expect(mockSetTag).toHaveBeenCalledWith("feature", "auth")
    expect(mockSetContext).toHaveBeenCalledWith("supabase_session_error", {
      name: "Error",
      message: "network error",
    })
    expect(mockCaptureMessage).toHaveBeenCalledWith("Supabase session retrieval failed", "error")
  })
})
