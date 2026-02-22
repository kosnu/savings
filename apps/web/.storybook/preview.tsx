import type { Preview } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
// biome-ignore lint: noUnusedImports: これがないとテスト実行時に `React is not defined` エラーが起きる
import React from "react"
import { createQueryClient } from "../src/lib/queryClient"
import { SnackbarProvider } from "../src/providers/snackbar"
import { SupabaseSessionContext } from "../src/providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../src/providers/theme/ThemeProvider"
import { mockSession } from "../src/test/data/supabaseSession"
import { worker } from "../src/test/msw/browser"

import "../src/assets/global.css"

let mswStarted = false

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  loaders: [
    async () => {
      if (!mswStarted) {
        await worker.start({ onUnhandledRequest: "bypass" })
        mswStarted = true
      }
    },
  ],
  decorators: [
    (Story) => {
      const queryClient = createQueryClient()

      return (
        <QueryClientProvider client={queryClient}>
          <SupabaseSessionContext
            value={{ session: mockSession(), loading: false }}
          >
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
