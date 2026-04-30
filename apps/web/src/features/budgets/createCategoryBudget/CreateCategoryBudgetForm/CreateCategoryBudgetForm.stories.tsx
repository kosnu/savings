import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { fn } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { createCategoryBudgetHandlers } from "../../../../test/msw/handlers/categoryBudgets"
import { CreateCategoryBudgetForm } from "./CreateCategoryBudgetForm"

const meta = {
  title: "Features/Budgets/CreateCategoryBudgetForm",
  component: CreateCategoryBudgetForm,
  parameters: {
    layout: "centered",
    msw: {
      handlers: [...createCategoryHandlers(), ...createCategoryBudgetHandlers()],
    },
  },
  tags: ["autodocs"],
  args: {
    onCancel: fn(),
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
} satisfies Meta<typeof CreateCategoryBudgetForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onSuccess: fn(),
    onError: fn(),
  },
}
