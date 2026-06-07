import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"

import { createQueryClient } from "../../../../lib/queryClient"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createCategorySettingsHandlers } from "../../../../test/msw/handlers/categorySettings"
import { CreateCategoryModal } from "./CreateCategoryModal"

const meta = {
  title: "Features/Categories/CreateCategory/CreateCategoryModal",
  component: CreateCategoryModal,
  parameters: {
    msw: {
      handlers: createCategorySettingsHandlers(),
    },
  },
  tags: ["autodocs"],
  decorators: (Story) => {
    const queryClient = createQueryClient()

    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      </ThemeProvider>
    )
  },
} satisfies Meta<typeof CreateCategoryModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
