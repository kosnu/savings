import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"

import { createQueryClient } from "../../../../lib/queryClient"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { CreateMonthlyBudgetModal } from "./CreateMonthlyBudgetModal"

const meta = {
  title: "Features/Budgets/CreateMonthlyBudget/CreateMonthlyBudgetModal",
  component: CreateMonthlyBudgetModal,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
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
} satisfies Meta<typeof CreateMonthlyBudgetModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
