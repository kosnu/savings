import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"

import { createQueryClient } from "../../../../lib/queryClient"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createCategorySettingsHandlers } from "../../../../test/msw/handlers/categorySettings"
import { UpdateCategoryNameModal } from "./UpdateCategoryNameModal"

const meta = {
  title: "Features/Categories/UpdateCategoryNameModal",
  component: UpdateCategoryNameModal,
  parameters: {
    layout: "centered",
    msw: {
      handlers: createCategorySettingsHandlers(),
    },
  },
  tags: ["autodocs"],
  args: {
    category: {
      id: 10,
      name: "Food",
    },
  },
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
} satisfies Meta<typeof UpdateCategoryNameModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
