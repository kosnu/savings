import type { Meta, StoryObj } from "@storybook/react-vite"

import { monthlyBudgets } from "../../../../test/data/monthlyBudgets"
import { createStoryRouter, paymentsRouteBuilder } from "../../../../test/helpers/routerDecorator"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { MonthSelector } from "../../MonthSelector"
import { MonthlySpendingChart } from "./MonthlySpendingChart"

const meta = {
  title: "Features/SummaryByMonth/MonthlySpendingChart",
  component: MonthlySpendingChart,
  tags: ["autodocs"],
  args: { bookId: 1 },
  decorators: [
    (Story) => (
      <>
        <MonthSelector />
        <Story />
      </>
    ),
    createStoryRouter("/payments?year=2025&month=6", paymentsRouteBuilder),
  ],
  parameters: {
    mockingDate: new Date(2025, 5, 15),
    msw: {
      handlers: [
        ...createPaymentHandlers(),
        ...createMonthlyBudgetHandlers({
          get: { response: { ...monthlyBudgets[2], amount: 15000 } },
        }),
      ],
    },
  },
} satisfies Meta<typeof MonthlySpendingChart>

export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Loading: Story = { args: { loading: true } }
export const SpendingLoading: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers({ get: { durationOrMode: "infinite" } }),
        ...createMonthlyBudgetHandlers(),
      ],
    },
  },
}
export const BudgetLoading: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers(),
        ...createMonthlyBudgetHandlers({ get: { durationOrMode: "infinite" } }),
      ],
    },
  },
}
export const SpendingError: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers({ get: { error: true } }),
        ...createMonthlyBudgetHandlers(),
      ],
    },
  },
}
export const BudgetError: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers(),
        ...createMonthlyBudgetHandlers({ get: { error: true } }),
      ],
    },
  },
}
