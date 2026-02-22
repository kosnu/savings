import type { Preview } from "@storybook/react-vite"
import type { Session } from "@supabase/supabase-js"
import { QueryClientProvider } from "@tanstack/react-query"
// biome-ignore lint: noUnusedImports: これがないとテスト実行時に `React is not defined` エラーが起きる
import React from "react"
import { createQueryClient } from "../src/lib/queryClient"
import { SnackbarProvider } from "../src/providers/snackbar"
import { SupabaseSessionContext } from "../src/providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../src/providers/theme/ThemeProvider"

const mockSession = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "mock-user-id",
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: "",
  },
} as Session

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
            value={{ session: mockSession, loading: false }}
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
