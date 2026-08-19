import type { Preview } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { mswLoader } from "msw-storybook-addon/csf3"
import { setupWorker } from "msw/browser"

import { createQueryClient } from "../src/lib/queryClient"
import { SnackbarProvider } from "../src/providers/snackbar/SnackbarProvider"
import { SupabaseSessionContext } from "../src/providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../src/providers/theme/ThemeProvider"
import { mockSession } from "../src/test/data/supabaseSession"
import { authHandlers } from "../src/test/msw/handlers/auth"

import "../src/assets/global.css"
import "../src/i18n"

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
  loaders: [
    mswLoader(async () => {
      const worker = setupWorker()

      await worker.start({ onUnhandledRequest: "bypass", quiet: true })
      return worker
    }),
  ],
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
