import { composeStories } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { createQueryClient } from "../../../lib/queryClient"
import { SnackbarProvider } from "../../../providers/snackbar"
import { SupabaseSessionContext } from "../../../providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../../../providers/theme/ThemeProvider"
import { mockSession } from "../../../test/data/supabaseSession"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import * as stories from "./CategoryTotals.stories"

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

describe("CategoryTotals", () => {
  test("カテゴリ別合計を表示する", async () => {
    server.resetHandlers(...createPaymentHandlers(), ...createCategoryHandlers())
    renderStory()

    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(screen.getByLabelText(/category totals chunk 0/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/category totals chunk 1/i)).toBeInTheDocument()
    expect(await screen.findByText("Daily Necessities")).toBeInTheDocument()
    expect(await screen.findByText("Entertainment")).toBeInTheDocument()
    expect(await screen.findByText("￥1,000")).toBeInTheDocument()
    expect(await screen.findByText("￥4,000")).toBeInTheDocument()
    expect(await screen.findAllByText("￥0")).toHaveLength(2)
  })
})
