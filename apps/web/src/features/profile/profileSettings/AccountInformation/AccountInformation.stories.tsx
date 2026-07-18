import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Session } from "@supabase/supabase-js"
import { QueryClientProvider } from "@tanstack/react-query"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar/SnackbarProvider"
import { SupabaseSessionContext } from "../../../../providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { mockSession } from "../../../../test/data/supabaseSession"
import { createProfileHandlers } from "../../../../test/msw/handlers/profile"
import { AccountInformation } from "./AccountInformation"

function createProfileStoryParameters(options?: Parameters<typeof createProfileHandlers>[0]) {
  const createHandlers = () => createProfileHandlers(options)

  return {
    msw: { handlers: createHandlers() },
    profileHandlers: createHandlers,
  }
}

function isSession(value: unknown): value is Session {
  return typeof value === "object" && value !== null && "user" in value
}

const identityProviderSession = mockSession({
  user: {
    ...mockSession().user,
    app_metadata: {},
    identities: [
      {
        id: "mock-identity-id",
        user_id: "mock-user-id",
        identity_id: "mock-identity-id",
        provider: "google",
      },
    ],
  },
})

const unavailableProviderSession = mockSession({
  user: {
    ...mockSession().user,
    app_metadata: {},
  },
})

const meta = {
  title: "Features/Profile/ProfileSettings/AccountInformation",
  component: AccountInformation,
  tags: ["autodocs"],
  decorators: [
    (Story, context) => {
      const queryClient = createQueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      const profileSession = context.parameters.profileSession
      const session = isSession(profileSession) ? profileSession : mockSession()

      return (
        <QueryClientProvider client={queryClient}>
          <SupabaseSessionContext value={{ session, status: "authenticated" }}>
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
} satisfies Meta<typeof AccountInformation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: createProfileStoryParameters(),
}

export const Loading: Story = {
  parameters: createProfileStoryParameters({ get: { durationOrMode: "infinite" } }),
}

export const LoadError: Story = {
  parameters: createProfileStoryParameters({ get: { error: true } }),
}

export const IdentityProviderFallback: Story = {
  parameters: {
    ...createProfileStoryParameters(),
    profileSession: identityProviderSession,
  },
}

export const UnavailableLoginMethod: Story = {
  parameters: {
    ...createProfileStoryParameters(),
    profileSession: unavailableProviderSession,
  },
}
