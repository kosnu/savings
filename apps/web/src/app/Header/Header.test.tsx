import { composeStories } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"

import { createQueryClient } from "../../lib/queryClient"
import { SnackbarProvider } from "../../providers/snackbar"
import { SupabaseSessionContext } from "../../providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../../providers/theme/ThemeProvider"
import { mockSession } from "../../test/data/supabaseSession"
import * as stories from "./Header.stories"

const { Default } = composeStories(stories)

describe("Header", () => {
  test("メニューボタンを押すと onMenuClick が呼ばれ、Logo button を表示する", async () => {
    const user = userEvent.setup()
    const onMenuClick = vi.fn()
    render(
      <QueryClientProvider client={createQueryClient()}>
        <SupabaseSessionContext value={{ session: mockSession(), status: "authenticated" }}>
          <ThemeProvider>
            <SnackbarProvider>
              <Default onMenuClick={onMenuClick} />
            </SnackbarProvider>
          </ThemeProvider>
        </SupabaseSessionContext>
      </QueryClientProvider>,
    )

    await user.click(await screen.findByLabelText("Menu button"))

    expect(onMenuClick).toHaveBeenCalledTimes(1)
    expect(await screen.findByLabelText("Logo button")).toBeInTheDocument()
  })
})
