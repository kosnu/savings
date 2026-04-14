import type { Meta, StoryObj } from "@storybook/react-vite"

import { monthlyBudgets } from "../../../../test/data/monthlyBudgets"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { MonthlyBudgetUsage } from "./MonthlyBudgetUsage"

const targetDate = new Date(2025, 2, 1)
const monthlyBudget = { ...monthlyBudgets[2], amount: 30000 }

const meta = {
  title: "Features/Budgets/MonthlyBudgetUsage",
  component: MonthlyBudgetUsage,
  tags: ["autodocs"],
  parameters: {
    msw: {
      handlers: createMonthlyBudgetHandlers({
        get: { response: monthlyBudget },
      }),
    },
  },
  args: {
    targetDate,
    totalExpenditures: 10000,
    totalExpendituresError: null,
    totalExpendituresLoading: false,
  },
} satisfies Meta<typeof MonthlyBudgetUsage>

export default meta
type Story = StoryObj<typeof meta>

export const Remaining: Story = {}

export const Over: Story = {
  args: {
    totalExpenditures: 45000,
  },
}

export const NoBudget: Story = {
  parameters: {
    msw: {
      handlers: createMonthlyBudgetHandlers({
        get: { response: null },
      }),
    },
  },
}

export const FetchError: Story = {
  parameters: {
    msw: {
      handlers: createMonthlyBudgetHandlers({
        get: { error: true },
      }),
    },
  },
}

export const Loading: Story = {
  args: {
    totalExpenditures: null,
    totalExpendituresLoading: true,
  },
}
