import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"

import { createQueryClient } from "../../../../lib/queryClient"
import { SupabaseSessionContext } from "../../../../providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { mockSession } from "../../../../test/data/supabaseSession"
import { createBookHandlers } from "../../../../test/msw/handlers/books"
import { CurrentBookInformation } from "./CurrentBookInformation"

function createCurrentBookStoryParameters(options?: Parameters<typeof createBookHandlers>[0]) {
  const createHandlers = () => createBookHandlers(options)

  return {
    msw: { handlers: createHandlers() },
    bookHandlers: createHandlers,
  }
}

const meta = {
  title: "Features/Books/CurrentBookInformation",
  component: CurrentBookInformation,
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
              <Story />
            </ThemeProvider>
          </SupabaseSessionContext>
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof CurrentBookInformation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: createCurrentBookStoryParameters(),
}

export const Loading: Story = {
  parameters: createCurrentBookStoryParameters({ durationOrMode: "infinite" }),
}

export const FetchError: Story = {
  parameters: createCurrentBookStoryParameters({ error: true }),
}
