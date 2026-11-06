import type { Meta, StoryObj } from "@storybook/react-vite"
import { AuthError } from "@supabase/supabase-js"
import { spyOn, userEvent, within } from "storybook/test"

import { i18next } from "../../../../i18n"
import { getSupabaseClient } from "../../../../lib/supabase"
import {
  createAccountDeletionHandlers,
  deletionRequestId,
  deletionSecret,
  deletionTimes,
} from "../../../../test/msw/handlers/accountDeletion"
import { AccountDeletionStatus } from "./AccountDeletionStatus"

const meta = {
  title: "Features/Profile/AccountDeletionStatus",
  component: AccountDeletionStatus,
  tags: ["autodocs"],
} satisfies Meta<typeof AccountDeletionStatus>
export default meta
type Story = StoryObj<typeof meta>
const lookup: Story["play"] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await userEvent.type(canvas.getByLabelText(i18next.t("deletion.requestId")), deletionRequestId)
  await userEvent.type(canvas.getByLabelText(i18next.t("deletion.secret")), deletionSecret)
  await userEvent.click(canvas.getByRole("button", { name: i18next.t("deletion.check") }))
}
const resultParameters = (status: "pending" | "cancelled" | "completed", options = {}) => ({
  msw: {
    handlers: createAccountDeletionHandlers({
      result: {
        requestId: deletionRequestId,
        secret: deletionSecret,
        result: { status, ...deletionTimes },
        ...options,
      },
    }),
  },
})

export const Default: Story = { parameters: { msw: { handlers: createAccountDeletionHandlers() } } }
export const Pending: Story = {
  args: {
    initialState: {
      status: "pending",
      request_id: deletionRequestId,
      can_reactivate: true,
      ...deletionTimes,
    },
  },
}
export const Waiting: Story = {
  args: {
    initialState: {
      status: "pending",
      request_id: deletionRequestId,
      can_reactivate: false,
      delete_after: new Date(Date.now() - 60_000).toISOString(),
      purge_after: new Date(Date.now() + 60_000).toISOString(),
    },
  },
}
export const Delayed: Story = {
  args: {
    initialState: {
      status: "pending",
      request_id: deletionRequestId,
      can_reactivate: false,
      delete_after: "2020-01-01T00:00:00Z",
      purge_after: "2020-01-01T18:00:00Z",
    },
  },
}
export const Completed: Story = { parameters: resultParameters("completed"), play: lookup }
export const Cancelled: Story = { parameters: resultParameters("cancelled"), play: lookup }
export const Checking: Story = {
  parameters: resultParameters("pending", { durationOrMode: "infinite" }),
  play: lookup,
}
export const CheckError: Story = {
  parameters: resultParameters("pending", { error: true }),
  play: lookup,
}
export const CleanupError: Story = {
  beforeEach: () => {
    const mock = spyOn(getSupabaseClient().auth, "signOut").mockResolvedValue({
      error: new AuthError("Synthetic cleanup failure"),
    })
    return () => mock.mockRestore()
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: i18next.t("deletion.retryCleanup") }),
    )
  },
}
