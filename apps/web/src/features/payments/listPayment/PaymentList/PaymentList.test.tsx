import { composeStories } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test } from "vitest"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar"
import { SupabaseSessionContext } from "../../../../providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { mockSession } from "../../../../test/data/supabaseSession"
import * as stories from "./PaymentList.stories"

const { Default, Loading } = composeStories(stories)

function renderStory() {
  const queryClient = createQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <SupabaseSessionContext value={{ session: mockSession(), status: "authenticated" }}>
        <ThemeProvider>
          <SnackbarProvider>
            <Default />
          </SnackbarProvider>
        </ThemeProvider>
      </SupabaseSessionContext>
    </QueryClientProvider>,
  )
}

describe("PaymentList", () => {
  test("支払い行が button として並び、詳細内に削除導線がある", async () => {
    renderStory()

    expect(await screen.findAllByRole("button", { name: /コンビニ/ })).toHaveLength(2)
    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(await screen.findByText("Daily Necessities")).toBeInTheDocument()
  })

  test("キーボード操作で詳細を開いて閉じると元の行へフォーカスが戻る", async () => {
    const user = userEvent.setup()

    renderStory()

    const firstPaymentButton = (await screen.findAllByRole("button", { name: /コンビニ/ }))[0]
    firstPaymentButton.focus()
    expect(firstPaymentButton).toHaveFocus()

    await user.keyboard("{Enter}")

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    expect(within(dialog).getByText("Daily Necessities")).not.toHaveClass("rt-Badge")
    expect(within(dialog).getAllByText(/Date|Category|Note|Amount/)).toHaveLength(4)
    expect(within(dialog).getByText("Category")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: /delete/i })).toBeInTheDocument()

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /payment details/i })).not.toBeInTheDocument()
      expect(firstPaymentButton).toHaveFocus()
    })
  })

  test("金額編集中の Escape は詳細を閉じず、次の Escape で詳細を閉じる", async () => {
    const user = userEvent.setup()

    renderStory()

    const firstPaymentButton = (await screen.findAllByRole("button", { name: /コンビニ/ }))[0]
    await user.click(firstPaymentButton)

    const dialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(within(dialog).getByRole("button", { name: /edit amount/i }))

    expect(within(dialog).getByRole("textbox", { name: /amount/i })).toBeInTheDocument()

    await user.keyboard("{Escape}")

    expect(screen.getByRole("dialog", { name: /payment details/i })).toBeInTheDocument()
    expect(within(dialog).queryByRole("textbox", { name: /amount/i })).not.toBeInTheDocument()

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /payment details/i })).not.toBeInTheDocument()
    })
  })

  test("削除確認をキャンセルすると詳細へ戻る", async () => {
    const user = userEvent.setup()

    renderStory()

    const firstPaymentButton = (await screen.findAllByRole("button", { name: /コンビニ/ }))[0]
    await user.click(firstPaymentButton)

    const detailDialog = await screen.findByRole("dialog", { name: /payment details/i })
    await user.click(within(detailDialog).getByRole("button", { name: /delete this payment/i }))

    const deleteDialog = await screen.findByRole("dialog", { name: /delete this payment/i })
    expect(
      screen.getByRole("dialog", { name: /payment details/i, hidden: true }),
    ).toBeInTheDocument()
    await user.click(within(deleteDialog).getByRole("button", { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /delete this payment/i })).not.toBeInTheDocument()
    })

    expect(await screen.findByRole("dialog", { name: /payment details/i })).toBeInTheDocument()
  })

  test("Loading story ではスケルトンを 3 件表示する", async () => {
    const queryClient = createQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <SupabaseSessionContext value={{ session: mockSession(), status: "authenticated" }}>
          <ThemeProvider>
            <SnackbarProvider>
              <Loading />
            </SnackbarProvider>
          </ThemeProvider>
        </SupabaseSessionContext>
      </QueryClientProvider>,
    )

    expect(await screen.findAllByLabelText("loading-payment-item")).toHaveLength(3)
  })
})
