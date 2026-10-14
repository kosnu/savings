import { describe, expect, test, vi } from "vite-plus/test"

import {
  captureAuthCallbackError,
  captureMonthlyBudgetCreateError,
  captureSupabaseSessionError,
  initSentry,
} from "./sentry"

const { mockCaptureMessage, mockSetContext, mockSetTag, mockWithScope, mockInit } = vi.hoisted(
  () => {
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
      mockInit: vi.fn(),
      mockSetContext: setContextMock,
      mockSetTag: setTagMock,
      mockWithScope: withScopeMock,
    }
  },
)

vi.mock("../config/env", () => ({
  env: {
    MODE: "production",
    SENTRY_DSN: "https://public@example.com/1",
    SENTRY_ENVIRONMENT: "test",
  },
}))

vi.mock("@sentry/react", () => ({
  captureMessage: mockCaptureMessage,
  init: mockInit,
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
      code: "unknown",
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
    })
    expect(mockCaptureMessage).toHaveBeenCalledWith("Monthly budget creation failed", "error")
  })
})

describe("監視の失敗", () => {
  test("SDKがthrowしてもセッション・予算・認証エラー処理を妨げない", () => {
    mockWithScope.mockImplementationOnce(() => {
      throw new Error("SDK failed")
    })
    expect(() => captureSupabaseSessionError(new Error("session failed"))).not.toThrow()
    mockCaptureMessage.mockImplementationOnce(() => {
      throw new Error("SDK failed")
    })
    expect(() => captureMonthlyBudgetCreateError({ code: "23505" })).not.toThrow()
    mockWithScope.mockImplementationOnce(() => {
      throw new Error("SDK failed")
    })
    expect(() => captureAuthCallbackError({ code: "access_denied" })).not.toThrow()
  })
})

test("監視の初期化失敗をアプリ起動へ伝播させない", () => {
  mockInit.mockImplementationOnce(() => {
    throw new Error("SDK initialization failed")
  })
  expect(initSentry).not.toThrow()
})
