import { QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, test } from "vitest"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { foodCat } from "../../../../test/data/categories"
import { payments } from "../../../../test/data/payments"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { PaymentDetailsOverlay } from "./PaymentDetailsOverlay"

function renderOverlay(props: Partial<ComponentProps<typeof PaymentDetailsOverlay>> = {}) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider>
        <SnackbarProvider>
          <PaymentDetailsOverlay
            open
            onOpenChange={() => {}}
            onDelete={() => {}}
            category={foodCat}
            payment={payments[0]}
            {...props}
          />
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe("PaymentDetailsOverlay", () => {
  beforeEach(() => {
    server.resetHandlers(...createPaymentHandlers())
  })

  afterEach(() => {
    cleanup()
  })

  test("note が空でも値領域を維持してプレースホルダを表示する", async () => {
    renderOverlay({
      payment: {
        ...payments[0],
        note: "",
      },
    })

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })

    expect(within(dialog).getByText("No note")).toBeInTheDocument()
    expect(within(dialog).getAllByText(/Date|Category|Note|Amount/)).toHaveLength(4)
    expect(within(dialog).getByRole("button", { name: /delete/i })).toBeInTheDocument()
  })

  test("編集中の Escape はオーバーレイを閉じずに編集だけ解除する", async () => {
    const user = userEvent.setup()

    renderOverlay()

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(within(dialog).getByRole("button", { name: /edit amount/i }))

    const amountInput = within(dialog).getByRole("textbox", { name: /amount/i })
    await user.clear(amountInput)
    await user.type(amountInput, "2500")
    await user.keyboard("{Escape}")

    expect(screen.getByRole("dialog", { name: /payment details/i })).toBeInTheDocument()
    expect(within(dialog).queryByRole("textbox", { name: /amount/i })).not.toBeInTheDocument()
    expect(within(dialog).getByText(/1,000/)).toBeInTheDocument()
  })
})
