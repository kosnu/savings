import type { Meta, StoryObj } from "@storybook/react-vite"
import { AuthError } from "@supabase/supabase-js"
import { fn, spyOn } from "storybook/test"

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
import { DeletionHandoff } from "./DeletionHandoff"

const onSignedOut: () => void = fn()
const meta = {
  title: "Features/Profile/DeletionHandoff",
  component: DeletionHandoff,
  tags: ["autodocs"],
  args: { authUserId: deletionAuthUserId, initialState: null, onSignedOut },
  beforeEach: () => {
    const previousReceipt = localStorage.getItem(deletionReceiptKey)
    localStorage.setItem(
      deletionReceiptKey,
      JSON.stringify({
        authUserId: deletionAuthUserId,
        requestId: deletionRequestId,
        secret: deletionSecret,
        createdAt: Date.now(),
      }),
    )
    const session = mockSession()
    session.user.id = deletionAuthUserId
    const auth = getSupabaseClient().auth
    const getSession = spyOn(auth, "getSession").mockResolvedValue({
      data: { session },
      error: null,
    })
    const signOut = spyOn(auth, "signOut").mockResolvedValue({ error: null })
    return () => {
      if (previousReceipt === null) localStorage.removeItem(deletionReceiptKey)
      else localStorage.setItem(deletionReceiptKey, previousReceipt)
      getSession.mockRestore()
      signOut.mockRestore()
    }
  },
} satisfies Meta<typeof DeletionHandoff>
export default meta
type Story = StoryObj<typeof meta>

const result = { requestId: deletionRequestId, secret: deletionSecret }

export const Accepted: Story = {
  parameters: {
    msw: {
      handlers: createAccountDeletionHandlers({
        result: { ...result, result: { status: "pending", ...deletionTimes } },
      }),
    },
  },
}

export const Checking: Story = {
  parameters: {
    msw: {
      handlers: createAccountDeletionHandlers({
        result: { ...result, result: { status: "not_confirmed" }, durationOrMode: "infinite" },
      }),
    },
  },
}

export const NotConfirmed: Story = {
  parameters: { msw: { handlers: createAccountDeletionHandlers() } },
}

export const SignedOutNotConfirmed: Story = {
  ...NotConfirmed,
  beforeEach: () => {
    spyOn(getSupabaseClient().auth, "getSession").mockResolvedValue({
      data: { session: null },
      error: null,
    })
  },
}

export const LookupError: Story = {
  parameters: {
    msw: {
      handlers: createAccountDeletionHandlers({
        result: { ...result, result: { status: "not_confirmed" }, error: true },
      }),
    },
  },
}

export const SignOutError: Story = {
  ...Accepted,
  beforeEach: () => {
    spyOn(getSupabaseClient().auth, "signOut").mockResolvedValue({
      error: new AuthError("Sign-out failed"),
    })
  },
}
