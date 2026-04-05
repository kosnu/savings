import { composeStories } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test } from "vitest"

import { createQueryClient } from "../../../lib/queryClient"
import { SnackbarProvider } from "../../../providers/snackbar"
import { SupabaseSessionContext } from "../../../providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../../../providers/theme/ThemeProvider"
import { mockSession } from "../../../test/data/supabaseSession"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import * as stories from "./Summary.stories"

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

describe("Summary", () => {
  test("月次合計とカテゴリ別合計を表示できる", async () => {
    const user = userEvent.setup()

    server.resetHandlers(...createPaymentHandlers(), ...createCategoryHandlers())
    renderStory()

    expect(await screen.findByText("Total spending")).toBeInTheDocument()
    expect(await screen.findByText("￥5,000")).toBeInTheDocument()

    const accordionTrigger = screen.getByRole("button", {
      name: /by category/i,
    })
    await user.click(accordionTrigger)

    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(await screen.findByText("Daily Necessities")).toBeInTheDocument()
    expect(await screen.findByText("Entertainment")).toBeInTheDocument()
  })
})
