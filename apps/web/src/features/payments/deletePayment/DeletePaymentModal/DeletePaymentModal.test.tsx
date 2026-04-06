import { composeStories } from "@storybook/react-vite"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor, within } from "../../../../test/test-utils"
import * as stories from "./DeletePaymentModal.stories"

const { ClickDeleteButton, Default, DeleteFailureKeepsDialogOpen, NoPayment } =
  composeStories(stories)

function renderStory(story: React.ReactElement) {
  return render(story)
}

describe("DeletePaymentModal", () => {
  beforeEach(() => {
    server.resetHandlers(...createPaymentHandlers())
  })

  test("Default story ではダイアログを表示する", async () => {
    renderStory(<Default />)

    expect(await screen.findByRole("dialog", { name: /delete this payment/i })).toBeInTheDocument()
  })

  test("NoPayment story では未選択メッセージを表示して Delete を無効化する", async () => {
    renderStory(<NoPayment />)

    const dialog = await screen.findByRole("dialog", { name: /delete this payment/i })
    expect(within(dialog).getByText("Payment not found.")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: /delete/i })).toBeDisabled()
  })

  test("ClickDeleteButton story では削除成功後に onSuccess を呼ぶ", async () => {
    const onSuccess = vi.fn()
    server.resetHandlers(...createPaymentHandlers({ delete: { response: {} } }))
    const { user } = render(<ClickDeleteButton onSuccess={onSuccess} />)

    const dialog = await screen.findByRole("dialog", { name: /delete this payment/i })
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  test("DeleteFailureKeepsDialogOpen story では失敗時にダイアログを閉じない", async () => {
    server.resetHandlers(...createPaymentHandlers({ delete: { error: true } }))
    const { user } = render(<DeleteFailureKeepsDialogOpen />)

    const dialog = await screen.findByRole("dialog", { name: /delete this payment/i })
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }))

    expect(screen.getByRole("dialog", { name: /delete this payment/i })).toBeInTheDocument()
  })
})
