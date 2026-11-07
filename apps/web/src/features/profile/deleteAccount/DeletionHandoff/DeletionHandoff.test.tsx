import { composeStories } from "@storybook/react-vite"
import { AuthError } from "@supabase/supabase-js"
import { afterEach, expect, test, vi } from "vite-plus/test"

import {
  clearDeletionReceipt,
  createDeletionReceipt,
  readDeletionReceipt,
} from "../../../../lib/accountDeletion"
import { getSupabaseClient } from "../../../../lib/supabase"
import * as snackbar from "../../../../providers/snackbar/SnackbarProvider"
import { mockSession } from "../../../../test/data/supabaseSession"
import {
  createAccountDeletionHandlers,
  deletionAuthUserId,
  deletionRequestId,
  deletionTimes,
} from "../../../../test/msw/handlers/accountDeletion"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor } from "../../../../test/test-utils"
import * as stories from "./DeletionHandoff.stories"

const { Accepted, NotConfirmed, SignedOutNotConfirmed, LookupError, SignOutError } =
  composeStories(stories)
const accepted = { status: "pending", ...deletionTimes } as const
const notification = "Your account deletion request was accepted."
const auth = getSupabaseClient().auth

function mockAuth() {
  const session = mockSession()
  session.user.id = deletionAuthUserId
  return {
    getSession: vi.spyOn(auth, "getSession").mockResolvedValue({ data: { session }, error: null }),
    signOut: vi.spyOn(auth, "signOut").mockResolvedValue({ error: null }),
  }
}

afterEach(() => {
  clearDeletionReceipt()
  vi.restoreAllMocks()
})

test("本人の送信が確定したら受付を通知し、端末のセッションと照合情報を消去する", async () => {
  const { signOut } = mockAuth()
  createDeletionReceipt(deletionAuthUserId)
  const onSignedOut = vi.fn()
  render(<Accepted submission={Promise.resolve(accepted)} onSignedOut={onSignedOut} />)
  await waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1))
  expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" })
  expect(await screen.findByText(notification)).toBeInTheDocument()
  expect(readDeletionReceipt()).toBeNull()
})

test("送信結果が不明なら保存済みの受付番号とキーで自動照会する", async () => {
  const { signOut } = mockAuth()
  const receipt = createDeletionReceipt(deletionAuthUserId)
  server.use(...createAccountDeletionHandlers({ result: { ...receipt, result: accepted } }))
  const onSignedOut = vi.fn()
  render(
    <Accepted
      submission={Promise.resolve({ status: "not_confirmed" })}
      onSignedOut={onSignedOut}
    />,
  )
  await waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1))
  expect(await screen.findByText(notification)).toBeInTheDocument()
  expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" })
  expect(readDeletionReceipt()).toBeNull()
})

test("照合情報のない別端末でpendingを検知した場合は、受付通知を表示せずログアウトする", async () => {
  const { signOut } = mockAuth()
  const onSignedOut = vi.fn()
  render(
    <Accepted
      initialState={{ ...accepted, request_id: deletionRequestId, can_reactivate: true }}
      onSignedOut={onSignedOut}
    />,
  )
  await waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1))
  expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" })
  expect(screen.queryByText(notification)).not.toBeInTheDocument()
})

test("受付後に別人のセッションへ切り替わっていても、そのセッションを終了しない", async () => {
  const { getSession, signOut } = mockAuth()
  createDeletionReceipt(deletionAuthUserId)
  getSession.mockResolvedValue({ data: { session: mockSession() }, error: null })
  render(<Accepted submission={Promise.resolve(accepted)} />)
  await waitFor(() => expect(getSession).toHaveBeenCalled())
  expect(signOut).not.toHaveBeenCalled()
})

test("照会に失敗した場合は受付情報を保持し、再照会で確定した場合だけログアウトする", async () => {
  const { signOut } = mockAuth()
  const receipt = createDeletionReceipt(deletionAuthUserId)
  server.use(
    ...createAccountDeletionHandlers({ result: { ...receipt, result: accepted, error: true } }),
  )
  const onSignedOut = vi.fn()
  const { user } = render(<LookupError onSignedOut={onSignedOut} />)
  const retry = await screen.findByRole("button", { name: "Recheck request" })
  expect(
    screen.queryByRole("button", { name: "Review deletion request again" }),
  ).not.toBeInTheDocument()
  expect(screen.queryByText(notification)).not.toBeInTheDocument()
  expect(readDeletionReceipt()).toEqual(receipt)
  expect(signOut).not.toHaveBeenCalled()
  server.use(...createAccountDeletionHandlers({ result: { ...receipt, result: accepted } }))
  await user.click(retry)
  await waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1))
  expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" })
  expect(readDeletionReceipt()).toBeNull()
})

test("受付未確認時は再照会と本人による再送確認を表示し、確定操作を待つ", async () => {
  const { signOut } = mockAuth()
  const receipt = createDeletionReceipt(deletionAuthUserId)
  server.use(...createAccountDeletionHandlers())
  const { user } = render(<NotConfirmed />)
  expect(await screen.findByRole("button", { name: "Recheck request" })).toBeEnabled()
  await user.click(await screen.findByRole("button", { name: "Review deletion request again" }))
  expect(await screen.findByRole("button", { name: "Confirm deletion schedule" })).toBeEnabled()
  expect(readDeletionReceipt()).toEqual(receipt)
  expect(signOut).not.toHaveBeenCalled()
})

test("受付未確認でもログインしていなければ再送できず、照合情報を保持する", async () => {
  const { getSession, signOut } = mockAuth()
  const receipt = createDeletionReceipt(deletionAuthUserId)
  getSession.mockResolvedValue({ data: { session: null }, error: null })
  server.use(...createAccountDeletionHandlers())
  render(<SignedOutNotConfirmed />)
  expect(await screen.findByRole("button", { name: "Recheck request" })).toBeEnabled()
  expect(
    screen.queryByRole("button", { name: "Review deletion request again" }),
  ).not.toBeInTheDocument()
  expect(readDeletionReceipt()).toEqual(receipt)
  expect(signOut).not.toHaveBeenCalled()
})

test("受付後のログアウト失敗はログアウトだけを再試行し、端末の処理を完了する", async () => {
  const { signOut } = mockAuth()
  createDeletionReceipt(deletionAuthUserId)
  const openSnackbar = vi.fn()
  vi.spyOn(snackbar, "useSnackbar").mockReturnValue({ openSnackbar })
  signOut.mockResolvedValueOnce({ error: new AuthError("Sign-out failed") })
  const onSignedOut = vi.fn()
  const { user } = render(
    <SignOutError submission={Promise.resolve(accepted)} onSignedOut={onSignedOut} />,
  )
  const retry = await screen.findByRole("button", { name: "Retry sign-out" })
  expect(screen.queryByRole("button", { name: "Recheck request" })).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Review deletion request again" }),
  ).not.toBeInTheDocument()
  expect(onSignedOut).not.toHaveBeenCalled()
  await user.click(retry)
  await waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1))
  expect(openSnackbar).toHaveBeenCalledExactlyOnceWith("success", notification)
  expect(signOut).toHaveBeenCalledTimes(2)
  expect(signOut).toHaveBeenLastCalledWith({ scope: "local" })
  expect(readDeletionReceipt()).toBeNull()
})
