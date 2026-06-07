import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { fn } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { CreateMonthlyBudgetForm } from "./CreateMonthlyBudgetForm"

const meta = {
  title: "Features/Budgets/CreateMonthlyBudget/CreateMonthlyBudgetForm",
  component: CreateMonthlyBudgetForm,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
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
} satisfies Meta<typeof CreateMonthlyBudgetForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onSuccess: fn(),
    onError: fn(),
  },
}
