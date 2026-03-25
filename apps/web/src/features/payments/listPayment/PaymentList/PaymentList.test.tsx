import { composeStories } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test } from "vitest"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar"
import { SupabaseSessionContext } from "../../../../providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { mockSession } from "../../../../test/data/supabaseSession"
import * as stories from "./PaymentList.stories"

const { Default } = composeStories(stories)

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
  afterEach(() => {
    cleanup()
  })

  test("支払い行が button として並び、旧メニューを出さない", async () => {
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
    expect(
      within(dialog).queryByRole("button", { name: /delete payment/i }),
    ).not.toBeInTheDocument()

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /payment details/i })).not.toBeInTheDocument()
      expect(firstPaymentButton).toHaveFocus()
    })
  })
})
