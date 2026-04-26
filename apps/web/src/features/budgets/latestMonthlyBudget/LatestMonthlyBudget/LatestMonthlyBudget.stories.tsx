import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"

import { createQueryClient } from "../../../../lib/queryClient"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { monthlyBudgets } from "../../../../test/data/monthlyBudgets"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { LatestMonthlyBudget } from "./LatestMonthlyBudget"

const meta = {
  title: "Features/Budgets/LatestMonthlyBudget",
  component: LatestMonthlyBudget,
  parameters: {
    msw: {
      handlers: [
        ...createMonthlyBudgetHandlers({
          list: { response: [monthlyBudgets[3], monthlyBudgets[2]] },
        }),
      ],
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
} satisfies Meta<typeof LatestMonthlyBudget>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createMonthlyBudgetHandlers({
          list: { response: [] },
        }),
      ],
    },
  },
}

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createMonthlyBudgetHandlers({
          list: { response: [], durationOrMode: "infinite" },
        }),
      ],
    },
  },
}

export const FetchError: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createMonthlyBudgetHandlers({
          list: { error: true },
        }),
      ],
    },
  },
}
