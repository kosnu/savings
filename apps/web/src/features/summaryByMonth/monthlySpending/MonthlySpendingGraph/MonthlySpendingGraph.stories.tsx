import type { Meta, StoryObj } from "@storybook/react-vite"

import { MonthlySpendingGraph } from "./MonthlySpendingGraph"

const monthlyBudget = {
  id: 1,
  bookId: 1,
  amount: 15000,
  effectiveFrom: new Date(2025, 5, 1),
  effectiveYear: 2025,
  effectiveMonth: 6,
  status: "amount" as const,
  createdDate: new Date(2025, 5, 1),
  updatedDate: new Date(2025, 5, 1),
}

const meta = {
  title: "Features/SummaryByMonth/MonthlySpendingGraph",
  component: MonthlySpendingGraph,
  args: {
    payments: [
      { date: "2025-06-02", amount: 1000 },
      { date: "2025-06-10", amount: 4000 },
    ],
    budget: { status: "amount", monthlyBudget },
    targetDate: new Date(2025, 5, 1),
    today: new Date(2025, 5, 15),
    history: [
      {
        month: "2025-05",
        payments: [
          { date: "2025-05-20", amount: 2000 },
          { date: "2025-05-25", amount: 3000 },
        ],
      },
    ],
  },
} satisfies Meta<typeof MonthlySpendingGraph>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const OverBudget: Story = {
  args: { budget: { status: "amount", monthlyBudget: { ...monthlyBudget, amount: 8000 } } },
}
export const ZeroBudget: Story = {
  args: { budget: { status: "amount", monthlyBudget: { ...monthlyBudget, amount: 0 } } },
}
export const UnsetBudget: Story = { args: { budget: { status: "unset", monthlyBudget: null } } }
export const NoBudget: Story = { args: { budget: { status: "none", monthlyBudget: null } } }
export const Empty: Story = {
  args: {
    payments: [],
    history: [{ month: "2025-05", payments: [{ date: "2025-05-01", amount: 0 }] }],
  },
}
export const NoHistory: Story = { args: { history: [] } }
export const PastMonth: Story = { args: { today: new Date(2025, 6, 1) } }
export const FutureMonth: Story = { args: { today: new Date(2025, 4, 31) } }
export const ScheduledPayments: Story = {
  args: {
    payments: [
      { date: "2025-06-02", amount: 1000 },
      { date: "2025-06-25", amount: 20000 },
    ],
  },
}
