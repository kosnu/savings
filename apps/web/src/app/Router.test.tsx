import { beforeEach, expect, test, vi } from "vite-plus/test"

import { render, screen } from "../test/test-utils"
import { Router } from "./Router"

const mockRouterProvider = vi.fn(() => <div>router-provider</div>)
const mockUseSupabaseSession = vi.fn()
const mockInvalidate = vi.fn(async () => {})

vi.mock("@tanstack/react-router", () => ({
  RouterProvider: () => mockRouterProvider(),
}))

vi.mock("../providers/supabase/useSupabaseSession", () => ({
  useSupabaseSession: () => mockUseSupabaseSession(),
}))

vi.mock("./routes", () => ({
  router: {
    invalidate: async () => mockInvalidate(),
  },
}))

const testNamePattern = (
  globalThis as typeof globalThis & {
    __vitest_worker__?: { config: { testNamePattern?: RegExp } }
  }
).__vitest_worker__?.config.testNamePattern

function testCase(name: string, callback: () => void | Promise<void>) {
  if (testNamePattern && !testNamePattern.test(name)) {
    return
  }

  test(name, callback)
}

beforeEach(() => {
  mockRouterProvider.mockClear()
  mockUseSupabaseSession.mockReset()
  mockInvalidate.mockClear()
})

testCase("言語解決中は認証ローディング画面を表示する", () => {
  mockUseSupabaseSession.mockReturnValue({
    status: "loading",
    session: null,
  })

  render(<Router />, { withProviders: false })

  expect(screen.getByText("Checking authentication status...")).toBeInTheDocument()
  expect(screen.queryByText("router-provider")).not.toBeInTheDocument()
  expect(mockRouterProvider).not.toHaveBeenCalled()
})

testCase("authStatus が確定したら RouterProvider を描画する", () => {
  mockUseSupabaseSession.mockReturnValue({
    status: "authenticated",
    session: { access_token: "token" },
  })

  render(<Router />, { withProviders: false })

  expect(screen.getByText("router-provider")).toBeInTheDocument()
  expect(mockRouterProvider).toHaveBeenCalledTimes(1)
})
