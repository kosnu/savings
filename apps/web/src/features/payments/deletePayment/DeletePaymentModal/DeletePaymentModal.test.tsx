import { composeStories } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import * as stories from "./DeletePaymentModal.stories"

const { ClickDeleteButton, Default, DeleteFailureKeepsDialogOpen, NoPayment } =
  composeStories(stories)

function renderStory(story: React.ReactElement) {
  return render(
    <ThemeProvider>
      <QueryClientProvider client={createQueryClient()}>
        <SnackbarProvider>{story}</SnackbarProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
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

  test("ClickDeleteButton story では削除成功後にスナックバーを表示する", async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()

    server.resetHandlers(...createPaymentHandlers({ delete: { response: {} } }))
    renderStory(<ClickDeleteButton onSuccess={onSuccess} />)

    const dialog = await screen.findByRole("dialog", { name: /delete this payment/i })
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }))

    expect(await screen.findByText("Payment deleted successfully.")).toBeInTheDocument()
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  test("DeleteFailureKeepsDialogOpen story では失敗時にダイアログを閉じない", async () => {
    const user = userEvent.setup()

    server.resetHandlers(...createPaymentHandlers({ delete: { error: true } }))
    renderStory(<DeleteFailureKeepsDialogOpen />)

    const dialog = await screen.findByRole("dialog", { name: /delete this payment/i })
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }))

    expect(await screen.findByText("Failed to delete payment.")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: /delete this payment/i })).toBeInTheDocument()
  })
})
