import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar/SnackbarProvider"
import { SupabaseSessionContext } from "../../../../providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { mockSession } from "../../../../test/data/supabaseSession"
import { createProfileHandlers } from "../../../../test/msw/handlers/profile"
import { ProfileSettings } from "./ProfileSettings"

function createProfileStoryParameters(options?: Parameters<typeof createProfileHandlers>[0]) {
  const createHandlers = () => createProfileHandlers(options)

  return {
    msw: { handlers: createHandlers() },
    profileHandlers: createHandlers,
  }
}

const meta = {
  title: "Features/Profile/ProfileSettings/ProfileSettings",
  component: ProfileSettings,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      const queryClient = createQueryClient({
        defaultOptions: { queries: { retry: false } },
      })

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
} satisfies Meta<typeof ProfileSettings>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: createProfileStoryParameters(),
}

export const ProfileLoading: Story = {
  parameters: createProfileStoryParameters({ get: { durationOrMode: "infinite" } }),
}

export const ProfileError: Story = {
  parameters: createProfileStoryParameters({ get: { error: true } }),
}
