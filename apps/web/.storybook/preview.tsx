import type { Preview } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { initialize, mswLoader } from "msw-storybook-addon"
// import React from "react"

import { createQueryClient } from "../src/lib/queryClient"
import { SnackbarProvider } from "../src/providers/snackbar"
import { SupabaseSessionContext } from "../src/providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../src/providers/theme/ThemeProvider"
import { mockSession } from "../src/test/data/supabaseSession"
import { authHandlers } from "../src/test/msw/handlers/auth"

import "../src/assets/global.css"

// Storybook では未ハンドルな内部リクエストを素通しし、
// MSW の詳細ログも抑制してターミナル汚染を防ぐ。
initialize({ onUnhandledRequest: "bypass", quiet: true })

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    msw: {
      handlers: authHandlers,
    },
  },
  loaders: [mswLoader],
  decorators: [
    (Story) => {
      const queryClient = createQueryClient()

      return (
        <QueryClientProvider client={queryClient}>
          <SupabaseSessionContext value={{ session: mockSession(), status: "authenticated" }}>
            <ThemeProvider>
              <SnackbarProvider>
                <Story />
              </SnackbarProvider>
            </ThemeProvider>
          </SupabaseSessionContext>
        </QueryClientProvider>
      )
    },
  ],
}

export default preview
