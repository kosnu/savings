import { QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test } from "vitest"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { payments } from "../../../../test/data/payments"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { AmountField } from "./AmountField"

function renderAmountField(props: Partial<Parameters<typeof AmountField>[0]> = {}) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider>
        <SnackbarProvider>
          <AmountField paymentId={payments[0].id} amount={1000} {...props} />
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe("AmountField", () => {
  beforeEach(() => {
    server.resetHandlers(...createPaymentHandlers())
  })

  afterEach(() => {
    cleanup()
  })

  test("編集ボタンを押すと入力欄を開く", async () => {
    const user = userEvent.setup()

    renderAmountField()

    await user.click(screen.getByRole("button", { name: /edit amount/i }))

    expect(screen.getByRole("textbox", { name: /amount/i })).toBeInTheDocument()
  })

  test("編集中の Escape は編集だけ解除する", async () => {
    const user = userEvent.setup()

    renderAmountField()

    await user.click(screen.getByRole("button", { name: /edit amount/i }))
    const amountInput = screen.getByRole("textbox", { name: /amount/i })
    await user.clear(amountInput)
    await user.type(amountInput, "2500")
    await user.keyboard("{Escape}")

    expect(screen.queryByRole("textbox", { name: /amount/i })).not.toBeInTheDocument()
    expect(screen.getByText(/1,000/)).toBeInTheDocument()
  })

  test("保存ボタンで金額を保存できる", async () => {
    const user = userEvent.setup()

    renderAmountField()

    await user.click(screen.getByRole("button", { name: /edit amount/i }))
    const amountInput = screen.getByRole("textbox", { name: /amount/i })
    await user.clear(amountInput)
    await user.type(amountInput, "2500")
    await user.click(screen.getByRole("button", { name: /save amount/i }))

    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: /amount/i })).not.toBeInTheDocument()
    })

    expect(screen.getByText(/￥2,500/)).toBeInTheDocument()
  })

  test("保存失敗時は編集状態を維持してエラーを表示する", async () => {
    const user = userEvent.setup()

    server.resetHandlers(
      ...createPaymentHandlers({
        update: { error: true },
      }),
    )

    renderAmountField()

    await user.click(screen.getByRole("button", { name: /edit amount/i }))
    const amountInput = screen.getByRole("textbox", { name: /amount/i })
    await user.clear(amountInput)
    await user.type(amountInput, "2500")
    await user.click(screen.getByRole("button", { name: /save amount/i }))

    expect(
      await screen.findByText("Failed to update amount.", { selector: "span" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: /amount/i })).toBeInTheDocument()
  })

  test("保存中は入力欄と保存ボタンを操作不可にする", async () => {
    const user = userEvent.setup()

    server.resetHandlers(
      ...createPaymentHandlers({
        update: { durationOrMode: 1000 },
      }),
    )

    renderAmountField()

    await user.click(screen.getByRole("button", { name: /edit amount/i }))
    const amountInput = screen.getByRole("textbox", { name: /amount/i })
    await user.clear(amountInput)
    await user.type(amountInput, "2500")
    const saveButton = screen.getByRole("button", { name: /save amount/i })
    await user.click(saveButton)

    expect(amountInput).toBeDisabled()
    expect(saveButton).toBeDisabled()
    expect(screen.getByLabelText("saving")).toBeInTheDocument()
  })
})
