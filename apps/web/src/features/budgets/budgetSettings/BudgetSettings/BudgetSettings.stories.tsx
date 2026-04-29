import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"

import { createQueryClient } from "../../../../lib/queryClient"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createCategoryBudgetHandlers } from "../../../../test/msw/handlers/categoryBudgets"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { BudgetSettings } from "./BudgetSettings"

const meta = {
  title: "Features/Budgets/BudgetSettings",
  component: BudgetSettings,
  parameters: {
    msw: {
      handlers: [...createMonthlyBudgetHandlers(), ...createCategoryBudgetHandlers()],
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
} satisfies Meta<typeof BudgetSettings>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
