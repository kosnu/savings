import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within, screen, spyOn } from "storybook/test"

import { i18next } from "../../../../i18n"
import { getSupabaseClient } from "../../../../lib/supabase"
import { mockSession } from "../../../../test/data/supabaseSession"
import {
  createAccountDeletionHandlers,
  deletionAuthUserId,
  deletionRequestId,
  deletionSecret,
  deletionTimes,
} from "../../../../test/msw/handlers/accountDeletion"
import { DeleteAccount } from "./DeleteAccount"

const meta = {
  title: "Features/Profile/DeleteAccount",
  component: DeleteAccount,
} satisfies Meta<typeof DeleteAccount>
export default meta
type Story = StoryObj<typeof meta>
const parameters = (options?: Parameters<typeof createAccountDeletionHandlers>[0]) => ({
  msw: { handlers: createAccountDeletionHandlers(options) },
})
const open: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(
    within(canvasElement).getByRole("button", { name: i18next.t("deletion.open") }),
  )
}

export const Default: Story = { parameters: parameters() }
export const Confirmation: Story = { parameters: parameters(), play: open }
export const Loading: Story = {
  parameters: parameters({ preview: { durationOrMode: "infinite" } }),
  play: open,
}
export const LoadError: Story = { parameters: parameters({ preview: { error: true } }), play: open }
export const Unavailable: Story = {
  parameters: parameters({ preview: { response: { accepting_requests: false } } }),
  play: open,
}

export const Sending: Story = {
  beforeEach: () => {
    const session = mockSession()
    session.user.id = deletionAuthUserId
    const mock = spyOn(getSupabaseClient().auth, "getSession").mockResolvedValue({
      data: { session },
      error: null,
    })
    return () => mock.mockRestore()
  },
  parameters: parameters({
    request: {
      requestId: deletionRequestId,
      secret: deletionSecret,
      explanationVersion: "2026-11-06",
      result: { status: "pending", ...deletionTimes },
      durationOrMode: "infinite",
    },
  }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: i18next.t("deletion.open") }),
    )
    await userEvent.click(
      await screen.findByRole("button", { name: i18next.t("deletion.confirm") }),
    )
  },
}
