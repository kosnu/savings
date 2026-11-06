import { composeStories } from "@storybook/react-vite"
import { AuthError } from "@supabase/supabase-js"
import { beforeEach, expect, test, vi } from "vite-plus/test"

import { createDeletionReceipt, readDeletionReceipt } from "../../../../lib/accountDeletion"
import { getSupabaseClient } from "../../../../lib/supabase"
import { mockSession } from "../../../../test/data/supabaseSession"
import {
  createAccountDeletionHandlers,
  deletionAuthUserId,
  deletionTimes,
} from "../../../../test/msw/handlers/accountDeletion"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor } from "../../../../test/test-utils"
import * as stories from "./AccountDeletionStatus.stories"

const { Default, Pending, Waiting, Delayed } = composeStories(stories)
beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

test("保存情報がなければ受付を断定せず、番号入力や常設ログアウトを求めない", () => {
  render(<Default />)
  expect(screen.getByRole("heading", { name: "Account deletion request" })).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("could not confirm")
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Retry sign-out" })).not.toBeInTheDocument()
})

test("受付後は両時刻と復帰を案内し、期限後は復帰操作を表示しない", () => {
  const { unmount } = render(<Pending />)
  expect(screen.getByRole("status")).toHaveTextContent("request was accepted")
  expect(screen.getByText(/Return deadline:/)).toBeInTheDocument()
  expect(screen.getByText(/Deletion scheduled to start:/)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Return with Google" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Retry sign-out" })).not.toBeInTheDocument()
  unmount()
  const next = render(<Waiting />)
  expect(screen.getByText(/Deletion will start at the scheduled time/)).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Return with Google" })).not.toBeInTheDocument()
  next.unmount()
  render(<Delayed />)
  expect(screen.getByText(/Deletion has not finished yet/)).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Return with Google" })).not.toBeInTheDocument()
})

test("reload後も保存情報で自動確認し、完了した受付のキーを消す", async () => {
  const receipt = createDeletionReceipt(deletionAuthUserId)
  server.use(
    ...createAccountDeletionHandlers({
      result: {
        requestId: receipt.requestId,
        secret: receipt.secret,
        result: { status: "completed", ...deletionTimes },
      },
    }),
  )
  render(<Default />)
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("deletion is complete"))
  expect(readDeletionReceipt()).toBeNull()
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Return with Google" })).not.toBeInTheDocument()
})

test.each([false, true])(
  "通信失敗後の再試行を結果確定まで維持する（予約済み表示=%s）",
  async (pending) => {
    const receipt = createDeletionReceipt(deletionAuthUserId)
    const result = {
      requestId: receipt.requestId,
      secret: receipt.secret,
      result: { status: "pending" as const, ...deletionTimes },
    }
    server.use(...createAccountDeletionHandlers({ result: { ...result, error: true } }))
    const { user } = render(pending ? <Pending /> : <Default />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not connect")
    expect(readDeletionReceipt()).toEqual(receipt)
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    server.use(...createAccountDeletionHandlers({ result: { ...result, durationOrMode: 200 } }))
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(screen.getByRole("button", { name: "Try again" })).toBeDisabled()
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole("status")).toHaveTextContent("request was accepted")
    expect(screen.getByRole("heading", { name: "Account deletion request" })).toHaveFocus()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  },
)

test("本人のactive確認と未確定receiptが揃う場合だけ同じ受付の再送を案内する", async () => {
  createDeletionReceipt(deletionAuthUserId)
  const first = render(
    <Default initialState={{ status: "active" }} authUserId={deletionAuthUserId} />,
  )
  expect(
    await screen.findByRole("button", { name: "Review deletion request again" }),
  ).toBeInTheDocument()
  first.unmount()
  render(<Pending authUserId={deletionAuthUserId} />)
  expect(
    screen.queryByRole("button", { name: "Review deletion request again" }),
  ).not.toBeInTheDocument()
})

test("自動ログアウトの失敗時だけ再試行を表示し、成功後に外す", async () => {
  const receipt = createDeletionReceipt(deletionAuthUserId)
  server.use(
    ...createAccountDeletionHandlers({
      result: {
        requestId: receipt.requestId,
        secret: receipt.secret,
        result: { status: "pending", ...deletionTimes },
      },
    }),
  )
  const session = mockSession()
  session.user.id = deletionAuthUserId
  vi.spyOn(getSupabaseClient().auth, "getSession").mockResolvedValue({
    data: { session },
    error: null,
  })
  const signOut = vi
    .spyOn(getSupabaseClient().auth, "signOut")
    .mockResolvedValue({ error: new AuthError("Synthetic failure") })
  const path = window.location.href
  window.history.replaceState(null, "", "/account-deletion")
  try {
    const { user } = render(<Default />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign out")
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("request was accepted"),
    )
    let finishSignOut: (() => void) | undefined
    signOut.mockImplementationOnce(
      async () =>
        new Promise((resolve) => {
          finishSignOut = () => resolve({ error: null })
        }),
    )
    await user.click(screen.getByRole("button", { name: "Retry sign-out" }))
    expect(screen.getByRole("button", { name: "Retry sign-out" })).toBeDisabled()
    if (!finishSignOut) throw new Error("Sign-out was not started")
    finishSignOut()
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Retry sign-out" })).not.toBeInTheDocument(),
    )
    expect(signOut).toHaveBeenLastCalledWith({ scope: "local" })
    expect(screen.getByRole("heading", { name: "Account deletion request" })).toHaveFocus()
  } finally {
    window.history.replaceState(null, "", path)
  }
})

test.each([true, false])(
  "保存情報のない予約済み端末も本人のsessionだけを自動終了する（本人=%s）",
  async (sameUser) => {
    const session = mockSession()
    if (sameUser) session.user.id = deletionAuthUserId
    const getSession = vi
      .spyOn(getSupabaseClient().auth, "getSession")
      .mockResolvedValue({ data: { session }, error: null })
    const signOut = vi.spyOn(getSupabaseClient().auth, "signOut").mockResolvedValue({ error: null })
    render(<Pending authUserId={deletionAuthUserId} />)
    await waitFor(() => expect(getSession).toHaveBeenCalled())
    if (sameUser) await waitFor(() => expect(signOut).toHaveBeenCalledWith({ scope: "local" }))
    else expect(signOut).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Retry sign-out" })).not.toBeInTheDocument()
  },
)
