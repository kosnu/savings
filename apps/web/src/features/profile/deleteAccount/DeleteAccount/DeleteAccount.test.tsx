import { composeStories } from "@storybook/react-vite"
import { http, HttpResponse } from "msw"
import { beforeEach, expect, test, vi } from "vite-plus/test"

import * as accountDeletion from "../../../../lib/accountDeletion"
import { getSupabaseClient } from "../../../../lib/supabase"
import { mockSession } from "../../../../test/data/supabaseSession"
import {
  createAccountDeletionHandlers,
  deletionPreview,
} from "../../../../test/msw/handlers/accountDeletion"
import { server } from "../../../../test/msw/server"
import { act, render, screen } from "../../../../test/test-utils"
import { createDeferred } from "../../../../test/utils/createDeferred"
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

test("Contextの開始操作を一度だけ呼び、送信中の二重確定と取消を防ぐ", async () => {
  const startAccountDeletion = vi.fn()
  const { user } = render(<Default />, {
    sessionState: { status: "authenticated", session: mockSession(), startAccountDeletion },
  })
  await user.click(screen.getByRole("button", { name: "Schedule account deletion" }))
  await user.click(await screen.findByRole("button", { name: "Confirm deletion schedule" }))
  expect(startAccountDeletion).toHaveBeenCalledExactlyOnceWith(deletionPreview)
  expect(screen.getByRole("button", { name: "Confirm deletion schedule" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  await user.keyboard("{Escape}")
  expect(screen.getByRole("dialog")).toBeInTheDocument()
})

test.each(["success", "failure"])("開き直した後の古い説明取得の%sを反映しない", async (outcome) => {
  const first = createDeferred<accountDeletion.DeletionPreview>()
  const prepare = vi.spyOn(accountDeletion, "prepareAccountDeletion")
  prepare.mockImplementationOnce(async () => first.promise)
  prepare.mockResolvedValue({ ...deletionPreview, accepting_requests: false })
  const { user } = render(<Default />)
  const open = screen.getByRole("button", { name: "Schedule account deletion" })
  await user.click(open)
  expect(prepare).toHaveBeenCalledOnce()
  await user.keyboard("{Escape}")
  await user.click(open)
  const confirm = await screen.findByRole("button", { name: "Confirm deletion schedule" })
  expect(confirm).toBeDisabled()
  await act(async () => {
    if (outcome === "failure") first.reject(new Error("Old failure"))
    else first.resolve({ ...deletionPreview, accepting_requests: true })
    await first.promise.catch(() => undefined)
  })
  expect(confirm).toBeDisabled()
  expect(screen.getByText(/New deletion requests are currently unavailable/)).toBeVisible()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})
