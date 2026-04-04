import { composeStories } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { createQueryClient } from "../../lib/queryClient"
import { SnackbarProvider } from "../../providers/snackbar"
import { SupabaseSessionContext } from "../../providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../../providers/theme/ThemeProvider"
import { mockSession } from "../../test/data/supabaseSession"
import * as stories from "./Sidebar.stories"

const { Default, Closed } = composeStories(stories)

describe("Sidebar", () => {
  test("Default story では開いたサイドバーを表示する", async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <SupabaseSessionContext value={{ session: mockSession(), status: "authenticated" }}>
          <ThemeProvider>
            <SnackbarProvider>
              <Default />
            </SnackbarProvider>
          </ThemeProvider>
        </SupabaseSessionContext>
      </QueryClientProvider>,
    )

    const sidebar = await screen.findByRole("complementary")
    expect(await screen.findByText("My Savings")).toBeInTheDocument()
    expect(await screen.findByText("Sidebar Content")).toBeInTheDocument()
    expect(sidebar).toHaveAttribute("data-open", "true")
  })

  test("Closed story では閉じた状態を表示する", async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <SupabaseSessionContext value={{ session: mockSession(), status: "authenticated" }}>
          <ThemeProvider>
            <SnackbarProvider>
              <Closed />
            </SnackbarProvider>
          </ThemeProvider>
        </SupabaseSessionContext>
      </QueryClientProvider>,
    )

    const sidebar = await screen.findByRole("complementary")
    expect(await screen.findByText("My Savings")).toBeInTheDocument()
    expect(await screen.findByText("Sidebar Content")).toBeInTheDocument()
    expect(sidebar).toHaveAttribute("data-open", "false")
  })
})
