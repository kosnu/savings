import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { fn } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createCategorySettingsHandlers } from "../../../../test/msw/handlers/categorySettings"
import { CreateCategoryForm } from "./CreateCategoryForm"

const meta = {
  title: "Features/Categories/CreateCategory/CreateCategoryForm",
  component: CreateCategoryForm,
  parameters: {
    layout: "centered",
    msw: {
      handlers: createCategorySettingsHandlers(),
    },
  },
  tags: ["autodocs"],
  args: {
    onCancel: fn(),
    onSuccess: fn(),
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
} satisfies Meta<typeof CreateCategoryForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
