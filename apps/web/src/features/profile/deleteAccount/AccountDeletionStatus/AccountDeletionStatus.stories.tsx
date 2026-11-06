import type { Meta, StoryObj } from "@storybook/react-vite"
import { AuthError } from "@supabase/supabase-js"
import { spyOn } from "storybook/test"

import { deletionReceiptKey } from "../../../../lib/accountDeletion"
import { getSupabaseClient } from "../../../../lib/supabase"
import { mockSession } from "../../../../test/data/supabaseSession"
import {
  createAccountDeletionHandlers,
  deletionAuthUserId,
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
const savedReceipt = () => {
  const previous = localStorage.getItem(deletionReceiptKey)
  localStorage.setItem(
    deletionReceiptKey,
    JSON.stringify({
      requestId: deletionRequestId,
      secret: deletionSecret,
      authUserId: deletionAuthUserId,
      createdAt: Date.now(),
    }),
  )
  return () => {
    if (previous) localStorage.setItem(deletionReceiptKey, previous)
    else localStorage.removeItem(deletionReceiptKey)
  }
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
export const Completed: Story = {
  parameters: resultParameters("completed"),
  beforeEach: savedReceipt,
}
export const Cancelled: Story = {
  parameters: resultParameters("cancelled"),
  beforeEach: savedReceipt,
}
export const Checking: Story = {
  parameters: resultParameters("pending", { durationOrMode: "infinite" }),
  beforeEach: savedReceipt,
}
export const CheckError: Story = {
  parameters: resultParameters("pending", { error: true }),
  beforeEach: savedReceipt,
}
export const CleanupError: Story = {
  parameters: resultParameters("pending"),
  beforeEach: () => {
    const restoreReceipt = savedReceipt()
    const path = window.location.href
    window.history.replaceState(null, "", "/account-deletion")
    const session = mockSession()
    session.user.id = deletionAuthUserId
    const sessionMock = spyOn(getSupabaseClient().auth, "getSession").mockResolvedValue({
      data: { session },
      error: null,
    })
    const mock = spyOn(getSupabaseClient().auth, "signOut").mockResolvedValue({
      error: new AuthError("Synthetic cleanup failure"),
    })
    return () => {
      mock.mockRestore()
      sessionMock.mockRestore()
      restoreReceipt()
      window.history.replaceState(null, "", path)
    }
  },
}
