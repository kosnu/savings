import { composeStories } from "@storybook/react-vite"
import { http, HttpResponse } from "msw"
import { beforeEach, expect, test, vi } from "vite-plus/test"

import { deletionReceiptEvent, type DeletionSubmission } from "../../../../lib/accountDeletion"
import { getSupabaseClient } from "../../../../lib/supabase"
import { mockSession } from "../../../../test/data/supabaseSession"
import {
  createAccountDeletionHandlers,
  deletionPreview,
} from "../../../../test/msw/handlers/accountDeletion"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor } from "../../../../test/test-utils"
import * as stories from "./DeleteAccount.stories"

const { Default } = composeStories(stories)

beforeEach(() => {
  vi.restoreAllMocks()
  const session = mockSession()
  session.user.id = deletionPreview.auth_user_id
  vi.spyOn(getSupabaseClient().auth, "getSession").mockResolvedValue({
    data: { session },
    error: null,
  })
})

test("削除範囲と両時刻を確認し、初期focusの取消とEscapeは予約しない", async () => {
  const request = vi.fn()
  server.use(
    http.post("*/rest/v1/rpc/request_account_deletion", () => {
      request()
      return HttpResponse.json({})
    }),
  )
  const { user } = render(<Default />)
  await user.click(screen.getByRole("button", { name: "Schedule account deletion" }))
  expect(await screen.findByText(deletionPreview.email)).toBeInTheDocument()
  expect(screen.getByText(/Your account, books only you use/)).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Privacy policy" })).not.toBeInTheDocument()
  expect(screen.getByText(/Deletion scheduled to start:/)).toBeInTheDocument()
  expect(screen.getByText(/Return deadline:/)).toHaveTextContent("GMT+9")
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus()
  await user.keyboard("{Enter}")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Schedule account deletion" }))
  await screen.findByText(deletionPreview.email)
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(request).not.toHaveBeenCalled()
})

test("説明取得失敗中は確定せず、同じ画面の再取得で復帰する", async () => {
  server.use(...createAccountDeletionHandlers({ preview: { error: true } }))
  const { user } = render(<Default />)
  await user.click(screen.getByRole("button", { name: "Schedule account deletion" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not prepare")
  expect(
    screen.queryByRole("button", { name: "Confirm deletion schedule" }),
  ).not.toBeInTheDocument()
  server.use(...createAccountDeletionHandlers())
  await user.click(screen.getByRole("button", { name: "Try again" }))
  expect(await screen.findByRole("button", { name: "Confirm deletion schedule" })).toBeEnabled()
})

test("受付停止中は確定できない", async () => {
  server.use(
    ...createAccountDeletionHandlers({
      preview: { response: { accepting_requests: false } },
    }),
  )
  const { user } = render(<Default />)
  await user.click(screen.getByRole("button", { name: "Schedule account deletion" }))
  expect(await screen.findByRole("button", { name: "Confirm deletion schedule" })).toBeDisabled()
  expect(screen.getByText(/New deletion requests are currently unavailable/)).toBeInTheDocument()
})

test("追加ログインなしで受付を画面内に引き継ぎ、確認中の二重送信を停止する", async () => {
  const hidden = vi.fn<(event: Event) => void>()
  window.addEventListener(deletionReceiptEvent, hidden, { once: true })
  const sent = vi.fn()
  const oauth = vi.spyOn(getSupabaseClient().auth, "signInWithOAuth")
  server.use(
    http.post("*/rest/v1/rpc/request_account_deletion", async ({ request }) => {
      sent(await request.json())
      return HttpResponse.json({ status: "not_confirmed" })
    }),
  )
  const { user } = render(<Default />)
  await user.click(screen.getByRole("button", { name: "Schedule account deletion" }))
  await user.click(await screen.findByRole("button", { name: "Confirm deletion schedule" }))
  await waitFor(() => expect(sent).toHaveBeenCalledOnce())
  expect(hidden).toHaveBeenCalledOnce()
  const event = hidden.mock.calls[0][0]
  if (!(event instanceof CustomEvent)) throw new Error("Missing submission")
  const { receipt, result } = event.detail as DeletionSubmission
  expect(receipt.authUserId).toBe(deletionPreview.auth_user_id)
  expect(sent).toHaveBeenCalledWith({
    request_id: receipt.requestId,
    result_secret: receipt.secret,
    explanation_version: deletionPreview.explanation_version,
  })
  expect(await result).toEqual({ status: "not_confirmed" })
  expect(oauth).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Confirm deletion schedule" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  await user.keyboard("{Escape}")
  expect(screen.getByRole("dialog")).toBeInTheDocument()
})
