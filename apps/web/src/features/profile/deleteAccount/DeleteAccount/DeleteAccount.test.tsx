import { composeStories } from "@storybook/react-vite"
import { http, HttpResponse } from "msw"
import { beforeEach, expect, test, vi } from "vite-plus/test"

import { deletionReceiptEvent, readDeletionReceipt } from "../../../../lib/accountDeletion"
import {
  createAccountDeletionHandlers,
  deletionPreview,
} from "../../../../test/msw/handlers/accountDeletion"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor } from "../../../../test/test-utils"
import * as stories from "./DeleteAccount.stories"

const { Default } = composeStories(stories)
import { getSupabaseClient } from "../../../../lib/supabase"
import { mockSession } from "../../../../test/data/supabaseSession"

beforeEach(() => {
  localStorage.clear()
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
  expect(readDeletionReceipt()).toBeNull()
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

test("追加ログインなしで送信前に照会情報を保存し、保護画面と二重送信を停止する", async () => {
  // 応答が返らない瞬間の契約を検査するため、Storyに内部の停止条件を持ち込まない。
  const hidden = vi.fn()
  window.addEventListener(deletionReceiptEvent, hidden)
  const sent = vi.fn()
  const oauth = vi.spyOn(getSupabaseClient().auth, "signInWithOAuth")
  server.use(
    http.post("*/rest/v1/rpc/request_account_deletion", async ({ request }) => {
      const receipt = readDeletionReceipt()
      expect(receipt).not.toBeNull()
      if (!receipt) throw new Error("Receipt was not saved")
      expect(hidden).toHaveBeenCalledTimes(1)
      expect(await request.json()).toEqual({
        request_id: receipt.requestId,
        result_secret: receipt.secret,
        explanation_version: deletionPreview.explanation_version,
      })
      sent()
      return new Promise(() => {})
    }),
  )
  const { user } = render(<Default />)
  await user.click(screen.getByRole("button", { name: "Schedule account deletion" }))
  await user.click(await screen.findByRole("button", { name: "Confirm deletion schedule" }))
  await waitFor(() => expect(sent).toHaveBeenCalledTimes(1))
  expect(oauth).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Confirm deletion schedule" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  await user.keyboard("{Escape}")
  expect(screen.getByRole("dialog")).toBeInTheDocument()
  window.removeEventListener(deletionReceiptEvent, hidden)
})

test("未着の予約は本人が再確認して同じ受付番号・キーで再送する", async () => {
  const receipt = {
    requestId: "20870000-0000-4000-8000-000000000002",
    secret: "a".repeat(64),
    authUserId: deletionPreview.auth_user_id,
    createdAt: Date.now(),
  }
  const sent = vi.fn()
  server.use(
    http.post("*/rest/v1/rpc/request_account_deletion", async ({ request }) => {
      const body = await request.json()
      sent(body)
      return new Promise(() => {})
    }),
  )
  const { user } = render(<Default receipt={receipt} />)
  await user.click(screen.getByRole("button", { name: "Review deletion request again" }))
  await user.click(await screen.findByRole("button", { name: "Confirm deletion schedule" }))
  await waitFor(() =>
    expect(sent).toHaveBeenCalledWith({
      request_id: receipt.requestId,
      result_secret: receipt.secret,
      explanation_version: deletionPreview.explanation_version,
    }),
  )
})
