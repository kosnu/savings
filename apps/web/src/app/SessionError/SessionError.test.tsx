import { composeStories } from "@storybook/react-vite"
import { AuthError } from "@supabase/supabase-js"
import { fn } from "storybook/test"
import { expect, test, vi } from "vite-plus/test"

import { getLoginAuth } from "../../lib/explicitLogin"
import { render, screen } from "../../test/test-utils"
import * as stories from "./SessionError.stories"

const { Default, SignInRequired } = composeStories(stories)

test("認証確認失敗の説明と再試行操作を表示する", async () => {
  const retry = fn()
  const { user } = render(<Default onRetry={retry} />)
  expect(screen.getByRole("alert")).toHaveTextContent("Check your connection and try again.")
  expect(screen.getByRole("heading", { level: 1 })).toHaveFocus()
  await user.click(screen.getByRole("button", { name: "Try again" }))
  expect(retry).toHaveBeenCalledTimes(1)
})

test("再認証は既存と同じGoogle providerとcallbackで開始し、失敗後も再操作できる", async () => {
  const signIn = vi.spyOn(getLoginAuth(), "signInWithOAuth").mockResolvedValue({
    data: { provider: "google", url: null },
    error: new AuthError("synthetic"),
  })
  const { user } = render(<SignInRequired />)
  expect(screen.getByRole("alert")).toHaveTextContent("Please sign in again.")
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  const button = screen.getByRole("button", { name: "Sign in" })
  await user.click(button)
  expect(signIn).toHaveBeenCalledWith({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth` },
  })
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not start sign-in.")
  expect(button).toBeEnabled()
  await user.click(button)
  expect(signIn).toHaveBeenCalledTimes(2)
  signIn.mockRestore()
})
