import { composeStories } from "@storybook/react-vite"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import * as stories from "./AuthPage.stories"

const { WithAuthError } = composeStories(stories)

vi.mock("../../../utils/auth/useSupabaseSignIn", () => ({
  useSupabaseSignIn: () => ({
    signIn: vi.fn(),
  }),
}))

vi.mock("../../../lib/sentry", () => ({
  captureAuthCallbackError: vi.fn(),
}))

describe("AuthPage", () => {
  afterEach(() => {
    cleanup()
    window.history.replaceState({}, "", "/")
  })

  test("認証エラーがあるときは汎用メッセージを表示する", async () => {
    render(<WithAuthError />)

    expect(await screen.findByText("ログインに失敗しました")).toBeInTheDocument()
    expect(
      screen.getByText("認証を完了できませんでした。時間をおいて、もう一度お試しください。"),
    ).toBeInTheDocument()
    expect(screen.queryByText("Error code: unexpected_failure")).not.toBeInTheDocument()
    expect(screen.queryByText("Unable to exchange external code: abc")).not.toBeInTheDocument()
  })
})
