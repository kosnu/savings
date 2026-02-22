import type { Preview } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
// biome-ignore lint: noUnusedImports: これがないとテスト実行時に `React is not defined` エラーが起きる
import React from "react"
import { createQueryClient } from "../src/lib/queryClient"
import { SnackbarProvider } from "../src/providers/snackbar"
import { SupabaseSessionContext } from "../src/providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../src/providers/theme/ThemeProvider"
import { mockSession } from "../src/test/data/supabaseSession"

import "../src/assets/global.css"

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => {
      const queryClient = createQueryClient()

      return (
        <QueryClientProvider client={queryClient}>
          <SupabaseSessionContext.Provider
            value={{ session: mockSession(), loading: false }}
          >
            <ThemeProvider>
              <SnackbarProvider>
                <Story />
              </SnackbarProvider>
            </ThemeProvider>
          </SupabaseSessionContext.Provider>
        </QueryClientProvider>
      )
    },
  ],
}

export default preview
