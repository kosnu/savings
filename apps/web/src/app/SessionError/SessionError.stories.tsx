import type { Meta, StoryObj } from "@storybook/react-vite"
import { AuthError } from "@supabase/supabase-js"
import { fn, spyOn, userEvent, within } from "storybook/test"

import { i18next } from "../../i18n"
import { getLoginAuth } from "../../lib/explicitLogin"
import { SessionError } from "./SessionError"

const meta = {
  title: "App/SessionError",
  component: SessionError,
  tags: ["autodocs"],
  args: { onRetry: fn() },
  beforeEach: () => {
    const signIn = spyOn(getLoginAuth(), "signInWithOAuth").mockResolvedValue({
      data: { provider: "google", url: null },
      error: new AuthError("Synthetic sign-in failure"),
    })
    return () => signIn.mockRestore()
  },
} satisfies Meta<typeof SessionError>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SignInRequired: Story = { args: { requiresSignIn: true } }
export const SigningIn: Story = {
  args: { requiresSignIn: true },
  beforeEach: () => {
    const signIn = spyOn(getLoginAuth(), "signInWithOAuth").mockImplementation(
      async () => new Promise(() => {}),
    )
    return () => signIn.mockRestore()
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: i18next.t("auth.login") }),
    )
  },
}
export const SignInFailed: Story = {
  ...SignInRequired,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: i18next.t("auth.login") }),
    )
  },
}
