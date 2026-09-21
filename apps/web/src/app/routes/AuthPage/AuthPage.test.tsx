import { composeStories } from "@storybook/react-vite"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { i18next } from "../../../i18n"
import { render, screen } from "../../../test/test-utils"
import * as stories from "./AuthPage.stories"

const { Default, WithAuthError } = composeStories(stories)

const signIn = vi.hoisted(() => vi.fn())

vi.mock("../../../utils/auth/useSupabaseSignIn", () => ({
  useSupabaseSignIn: () => ({
    signIn,
  }),
}))

vi.mock("../../../lib/sentry", () => ({
  captureAuthCallbackError: vi.fn(),
}))

describe("AuthPage", () => {
  afterEach(async () => {
    window.history.replaceState({}, "", "/")
    await i18next.changeLanguage("en")
    signIn.mockClear()
  })

  test("開始案内を表示し、Google認証の操作を維持する", async () => {
    await i18next.changeLanguage("ja")
    const { user } = render(<Default />)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Burneto にログイン" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "まずは今日の支払いから。記録を重ねて、毎月のお金の使い方を見ていきましょう。",
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Googleで続ける" }))
    expect(signIn).toHaveBeenCalledOnce()
  })

  test("認証エラーがあるときは汎用メッセージを表示する", async () => {
    render(<WithAuthError />)

    expect(await screen.findByText("Sign-in failed")).toBeInTheDocument()
    expect(
      screen.getByText("Authentication could not be completed. Please wait and try again."),
    ).toBeInTheDocument()
    expect(screen.queryByText("Error code: unexpected_failure")).not.toBeInTheDocument()
    expect(screen.queryByText("Unable to exchange external code: abc")).not.toBeInTheDocument()
  })
})
