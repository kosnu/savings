import { composeStories } from "@storybook/react-vite"
import { AuthError } from "@supabase/supabase-js"
import { http, HttpResponse } from "msw"
import { afterEach, expect, test, vi } from "vite-plus/test"

import { createDeletionReceipt, type DeletionRequestResult } from "../../../../lib/accountDeletion"
import { getSupabaseClient } from "../../../../lib/supabase"
import * as snackbar from "../../../../providers/snackbar/SnackbarProvider"
import { mockSession } from "../../../../test/data/supabaseSession"
import { deletionAuthUserId, deletionTimes } from "../../../../test/msw/handlers/accountDeletion"
import { server } from "../../../../test/msw/server"
import { act, render, screen, waitFor } from "../../../../test/test-utils"
import { createDeferred } from "../../../../test/utils/createDeferred"
import * as stories from "./DeletionHandoff.stories"

const { Accepted, OtherDevice } = composeStories(stories)
const accepted = { status: "pending", ...deletionTimes } as const
const notification = "Your account deletion request was accepted."
const auth = getSupabaseClient().auth

function submission(result: DeletionRequestResult = accepted) {
  return { receipt: createDeletionReceipt(deletionAuthUserId), result: Promise.resolve(result) }
}

function mockAuth() {
  const session = mockSession()
  session.user.id = deletionAuthUserId
  return {
    getSession: vi.spyOn(auth, "getSession").mockResolvedValue({ data: { session }, error: null }),
    signOut: vi.spyOn(auth, "signOut").mockResolvedValue({ error: null }),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

test("本人の送信が確定したら受付を通知し、端末のセッションを終了する", async () => {
  const { signOut } = mockAuth()
  const onSignedOut = vi.fn()
  render(<Accepted submission={submission()} onSignedOut={onSignedOut} />)
  await waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1))
  expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" })
  expect(await screen.findByText(notification)).toBeInTheDocument()
})

test("照合情報のない別端末でpendingを検知した場合は、受付通知を表示せずログアウトする", async () => {
  const { signOut } = mockAuth()
  const onSignedOut = vi.fn()
  render(<OtherDevice onSignedOut={onSignedOut} />)
  await waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1))
  expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" })
  expect(screen.queryByText(notification)).not.toBeInTheDocument()
})

test("受付後に別人のセッションへ切り替わっていても、そのセッションを終了しない", async () => {
  const { getSession, signOut } = mockAuth()
  getSession.mockResolvedValue({ data: { session: mockSession() }, error: null })
  render(<Accepted submission={submission()} />)
  await waitFor(() => expect(getSession).toHaveBeenCalled())
  expect(signOut).not.toHaveBeenCalled()
})

test("本人切替後に届いた古いセッション照合結果で通知・ログアウトしない", async () => {
  const { getSession, signOut } = mockAuth()
  const first = createDeferred<Awaited<ReturnType<typeof auth.getSession>>>()
  getSession.mockImplementationOnce(async () => first.promise)
  const onFirstSignedOut = vi.fn()
  const onNextSignedOut = vi.fn()
  const { rerender } = render(<Accepted submission={submission()} onSignedOut={onFirstSignedOut} />)
  await waitFor(() => expect(getSession).toHaveBeenCalledOnce())

  const nextSession = mockSession()
  nextSession.user.id = "20870000-0000-4000-8000-000000000099"
  getSession.mockResolvedValue({ data: { session: nextSession }, error: null })
  rerender(
    <Accepted
      authUserId={nextSession.user.id}
      submission={undefined}
      onSignedOut={onNextSignedOut}
    />,
  )
  await waitFor(() => expect(onNextSignedOut).toHaveBeenCalledOnce())

  const firstSession = mockSession()
  firstSession.user.id = deletionAuthUserId
  await act(async () => {
    first.resolve({ data: { session: firstSession }, error: null })
    await first.promise
  })
  expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" })
  expect(onFirstSignedOut).not.toHaveBeenCalled()
  expect(screen.queryByText(notification)).not.toBeInTheDocument()
})

test.each([false, true])(
  "受付不明・照会失敗後は同じ画面の照会だけを再試行する（照会エラー=%s）",
  async (error) => {
    const { signOut } = mockAuth()
    const current = submission({ status: "not_confirmed" })
    const resubmit = vi.fn()
    const lookup = vi.fn()
    let retrying = false
    server.use(
      http.post("*/rest/v1/rpc/get_account_deletion_result", async ({ request }) => {
        lookup(await request.json())
        if (retrying) return HttpResponse.json(accepted)
        return error ? HttpResponse.error() : HttpResponse.json({ status: "not_confirmed" })
      }),
      http.post("*/rest/v1/rpc/request_account_deletion", () => {
        resubmit()
        return HttpResponse.json({}, { status: 403 })
      }),
    )
    const onSignedOut = vi.fn()
    const { user } = render(<Accepted submission={current} onSignedOut={onSignedOut} />)
    const retry = await screen.findByRole("button", { name: "Recheck request" })
    expect(screen.getAllByRole("button")).toEqual([retry])
    expect(screen.queryByText(notification)).not.toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
    retrying = true
    await user.click(retry)
    await waitFor(() => expect(onSignedOut).toHaveBeenCalledOnce())
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" })
    const expected = {
      request_id: current.receipt.requestId,
      result_secret: current.receipt.secret,
    }
    expect(lookup.mock.calls).toEqual([[expected], [expected]])
    expect(resubmit).not.toHaveBeenCalled()
  },
)

test("受付後のログアウト失敗はログアウトだけを再試行し、端末の処理を完了する", async () => {
  const { signOut } = mockAuth()
  const deletionRpc = vi.fn()
  server.use(
    http.post("*/rest/v1/rpc/:operation", ({ params }) => {
      deletionRpc(params.operation)
      return HttpResponse.json({}, { status: 403 })
    }),
  )
  const openSnackbar = vi.fn()
  vi.spyOn(snackbar, "useSnackbar").mockReturnValue({ openSnackbar })
  signOut.mockResolvedValueOnce({ error: new AuthError("Sign-out failed") })
  const onSignedOut = vi.fn()
  const { user } = render(<Accepted submission={submission()} onSignedOut={onSignedOut} />)
  const retry = await screen.findByRole("button", { name: "Retry sign-out" })
  expect(screen.queryByRole("button", { name: "Recheck request" })).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Review deletion request again" }),
  ).not.toBeInTheDocument()
  expect(onSignedOut).not.toHaveBeenCalled()
  await user.click(retry)
  await waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1))
  expect(openSnackbar).toHaveBeenCalledExactlyOnceWith("success", notification)
  expect(deletionRpc).not.toHaveBeenCalled()
  expect(signOut).toHaveBeenCalledTimes(2)
  expect(signOut).toHaveBeenLastCalledWith({ scope: "local" })
})

test.each([
  ["unavailable", "New deletion requests are currently unavailable"],
  ["explanation", "The deletion information has changed"],
  ["session", "We could not verify your account"],
] as const)("明示拒否%sは再照会せず、本人の状態を確認して戻る", async (reason, message) => {
  const { signOut } = mockAuth()
  const lookup = vi.fn()
  server.use(
    http.post("*/rest/v1/rpc/get_account_deletion_result", () => {
      lookup()
      return HttpResponse.json({ status: "not_confirmed" })
    }),
  )
  const onCheckSession = vi.fn()
  const { user } = render(
    <Accepted
      submission={submission({ status: "rejected", reason })}
      onCheckSession={onCheckSession}
    />,
  )
  expect(await screen.findByRole("alert")).toHaveTextContent(message)
  expect(screen.queryByRole("button", { name: "Recheck request" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Check account and return" }))
  expect(onCheckSession).toHaveBeenCalledOnce()
  expect(lookup).not.toHaveBeenCalled()
  expect(signOut).not.toHaveBeenCalled()
})

test("既存の予約は本人の状態を確認し、今回の受付通知を出さない", async () => {
  const { signOut } = mockAuth()
  const onCheckSession = vi.fn()
  render(
    <Accepted
      submission={submission({ status: "rejected", reason: "pending" })}
      onCheckSession={onCheckSession}
    />,
  )
  await waitFor(() => expect(onCheckSession).toHaveBeenCalledOnce())
  expect(signOut).not.toHaveBeenCalled()
  expect(screen.queryByText(notification)).not.toBeInTheDocument()
})
