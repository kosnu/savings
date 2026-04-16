import type { Meta, StoryObj } from "@storybook/react-vite"

import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createStoryRouter, paymentsRouteBuilder } from "../../../test/helpers/routerDecorator"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { MonthlyTotals } from "./MonthlyTotals"

const meta = {
  title: "Features/SummaryByMonth/MonthlyTotals",
  component: MonthlyTotals,
  tags: ["autodocs"],
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers({
          getMonthlyTotalAmount: { response: 10000 },
        }),
        ...createMonthlyBudgetHandlers({
          get: { response: { ...monthlyBudgets[2], amount: 30000 } },
        }),
      ],
    },
  },
  decorators: [createStoryRouter("/payments?year=2025&month=06", paymentsRouteBuilder)],
} satisfies Meta<typeof MonthlyTotals>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}
