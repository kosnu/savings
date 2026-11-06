import { composeStories } from "@storybook/react-vite"
import { beforeEach, expect, test, vi } from "vite-plus/test"

import { createDeletionReceipt, readDeletionReceipt } from "../../../../lib/accountDeletion"
import {
  createAccountDeletionHandlers,
  deletionAuthUserId,
  deletionRequestId,
  deletionSecret,
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

test("照合情報がない場合は確認不能と示し、自動ログインしない", () => {
  render(<Default />)
  expect(screen.getByRole("heading", { name: "Account deletion status" })).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("cannot be confirmed")
  expect(screen.getByRole("button", { name: "Check result" })).toBeDisabled()
})

test("予約受付・復帰猶予・03時待ち・開始後遅延を完了と区別する", () => {
  const { unmount } = render(<Pending />)
  expect(screen.getByRole("status")).toHaveTextContent("not yet complete")
  expect(screen.getByText(/A new Google sign-in by you before/)).toBeInTheDocument()
  unmount()
  const next = render(<Waiting />)
  expect(screen.getByText(/waiting for the scheduled 03:00/)).toBeInTheDocument()
  next.unmount()
  render(<Delayed />)
  expect(screen.getByText(/processing or delayed/)).toBeInTheDocument()
})

test("reload後に同じ受付で照会し、完了が確認されたら保存キーを消す", async () => {
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
  expect(screen.getByLabelText("Confirmation key")).toHaveValue("")
  expect(screen.queryByRole("button", { name: "Return with Google" })).not.toBeInTheDocument()
})

test("通信失敗は成功にせず、入力を保持して匿名照会を再試行できる", async () => {
  server.use(
    ...createAccountDeletionHandlers({
      result: {
        requestId: deletionRequestId,
        secret: deletionSecret,
        result: { status: "cancelled", ...deletionTimes },
        error: true,
      },
    }),
  )
  const { user } = render(<Default />)
  await user.type(screen.getByLabelText("Receipt number"), deletionRequestId)
  await user.type(screen.getByLabelText("Confirmation key"), deletionSecret)
  await user.click(screen.getByRole("button", { name: "Check result" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not check")
  expect(screen.getByLabelText("Confirmation key")).toHaveValue(deletionSecret)
  server.use(
    ...createAccountDeletionHandlers({
      result: {
        requestId: deletionRequestId,
        secret: deletionSecret,
        result: { status: "cancelled", ...deletionTimes },
      },
    }),
  )
  await user.click(screen.getByRole("button", { name: "Check result" }))
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("was cancelled"))
})

test("手入力した別要求の完了では保存中の受付を消去せず、キーを確認して保管できる", async () => {
  const saved = createDeletionReceipt(deletionAuthUserId)
  server.use(
    ...createAccountDeletionHandlers({
      result: {
        requestId: deletionRequestId,
        secret: deletionSecret,
        result: { status: "completed", ...deletionTimes },
      },
    }),
  )
  const { user } = render(<Default />)
  await waitFor(() => expect(screen.getByRole("button", { name: "Check result" })).toBeEnabled())
  await user.click(screen.getByRole("button", { name: "Show confirmation key" }))
  expect(screen.getByLabelText("Confirmation key")).toHaveAttribute("type", "text")
  expect(screen.getByLabelText("Confirmation key")).toHaveValue(saved.secret)
  await user.clear(screen.getByLabelText("Receipt number"))
  await user.type(screen.getByLabelText("Receipt number"), deletionRequestId)
  await user.clear(screen.getByLabelText("Confirmation key"))
  await user.type(screen.getByLabelText("Confirmation key"), deletionSecret)
  await user.click(screen.getByRole("button", { name: "Check result" }))
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("deletion is complete"))
  expect(readDeletionReceipt()).toEqual(saved)
})

test("本人のactive確認と未確定receiptが揃う場合だけ同じ受付の再送を案内する", async () => {
  createDeletionReceipt(deletionAuthUserId)
  const first = render(
    <Default initialState={{ status: "active" }} authUserId={deletionAuthUserId} />,
  )
  expect(
    await screen.findByRole("button", { name: "Review resending the same receipt" }),
  ).toBeInTheDocument()
  first.unmount()
  render(<Pending authUserId={deletionAuthUserId} />)
  expect(
    screen.queryByRole("button", { name: "Review resending the same receipt" }),
  ).not.toBeInTheDocument()
})
