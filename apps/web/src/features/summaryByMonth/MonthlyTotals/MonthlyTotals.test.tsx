import { composeStories } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { createQueryClient } from "../../../lib/queryClient"
import { SnackbarProvider } from "../../../providers/snackbar"
import { SupabaseSessionContext } from "../../../providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../../../providers/theme/ThemeProvider"
import { mockSession } from "../../../test/data/supabaseSession"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import * as stories from "./MonthlyTotals.stories"

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

describe("MonthlyTotals", () => {
  test("月次合計を表示する", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        getMonthlyTotalAmount: { response: 10000 },
      }),
    )
    renderStory()

    expect(await screen.findByText("Total spending")).toBeInTheDocument()
    expect(await screen.findByText("￥10,000")).toBeInTheDocument()
  })
})
