import { describe, expect, test, vi } from "vite-plus/test"

import {
  captureAuthCallbackError,
  captureMonthlyBudgetCreateError,
  captureSupabaseSessionError,
} from "./sentry"

const { mockCaptureMessage, mockSetContext, mockSetTag, mockWithScope } = vi.hoisted(() => {
  const setContextMock = vi.fn()
  const setTagMock = vi.fn()
  const captureMessageMock = vi.fn()
  const withScopeMock = vi.fn((callback: (scope: object) => void) => {
    callback({
      setContext: setContextMock,
      setTag: setTagMock,
    })
  })

  return {
    mockCaptureMessage: captureMessageMock,
    mockSetContext: setContextMock,
    mockSetTag: setTagMock,
    mockWithScope: withScopeMock,
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

describe("captureMonthlyBudgetCreateError", () => {
  test("Sentry に月予算作成失敗を送る", () => {
    captureMonthlyBudgetCreateError({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    })

    expect(mockSetTag).toHaveBeenCalledWith("feature", "budgets")
    expect(mockSetContext).toHaveBeenCalledWith("monthly_budget_create_error", {
      code: "23505",
      name: undefined,
      message: "duplicate key value violates unique constraint",
    })
    expect(mockCaptureMessage).toHaveBeenCalledWith("Monthly budget creation failed", "error")
  })
})
