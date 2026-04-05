import { beforeEach, describe, expect, test, vi } from "vitest"

import { render, screen } from "../test/test-utils"
import { Router } from "./Router"

const mockRouterProvider = vi.fn(() => <div>router-provider</div>)
const mockUseSupabaseSession = vi.fn()
const mockInvalidate = vi.fn(async () => {})

vi.mock("@tanstack/react-router", () => ({
  RouterProvider: () => mockRouterProvider(),
}))

vi.mock("../providers/supabase", () => ({
  useSupabaseSession: () => mockUseSupabaseSession(),
}))

vi.mock("./routes", () => ({
  router: {
    invalidate: () => mockInvalidate(),
  },
}))

describe("Router", () => {
  beforeEach(() => {
    mockRouterProvider.mockClear()
    mockUseSupabaseSession.mockReset()
    mockInvalidate.mockClear()
  })

  test("authStatus が loading の間はローディング UI を表示し、RouterProvider を描画しない", () => {
    mockUseSupabaseSession.mockReturnValue({
      status: "loading",
      session: null,
    })

    render(<Router />, { withProviders: false })

    expect(screen.getByText("認証状態を確認しています...")).toBeInTheDocument()
    expect(screen.queryByText("router-provider")).not.toBeInTheDocument()
    expect(mockRouterProvider).not.toHaveBeenCalled()
  })

  test("authStatus が確定したら RouterProvider を描画する", () => {
    mockUseSupabaseSession.mockReturnValue({
      status: "authenticated",
      session: { access_token: "token" },
    })

    render(<Router />, { withProviders: false })

    expect(screen.getByText("router-provider")).toBeInTheDocument()
    expect(mockRouterProvider).toHaveBeenCalledTimes(1)
  })
})
