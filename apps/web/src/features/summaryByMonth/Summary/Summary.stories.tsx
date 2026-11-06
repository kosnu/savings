import { Container } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createStoryRouter, paymentsRouteBuilder } from "../../../test/helpers/routerDecorator"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { MonthlySpendingChart } from "../monthlySpending/MonthlySpendingChart"
import { Summary } from "./Summary"

const meta = {
  title: "Features/SummaryByMonth/Summary",
  component: Summary,
  parameters: {
    layout: "centered",
    msw: {
      handlers: [
        ...createPaymentHandlers(),
        ...createCategoryHandlers(),
        ...createMonthlyBudgetHandlers({
          get: { response: { ...monthlyBudgets[2], amount: 25000 } },
        }),
      ],
    },
  },
  argTypes: {},
  args: {},
  decorators: [
    createStoryRouter("/payments?year=2025&month=06", paymentsRouteBuilder),
    (Story) => (
      <Container size="4">
        <Story />
      </Container>
    ),
  ],
} satisfies Meta<typeof Summary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers({
          getMonthlyTotalAmount: { durationOrMode: "infinite" },
        }),
        ...createCategoryHandlers({
          get: { durationOrMode: "infinite" },
        }),
        ...createMonthlyBudgetHandlers({
          get: { durationOrMode: "infinite" },
        }),
      ],
    },
  },
}

export const InitialLoading: Story = {
  args: { loading: true, reserveSpace: true },
}

export const Error: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers({
          getMonthlyTotalAmount: { error: true },
        }),
        ...createCategoryHandlers({
          get: { error: true },
        }),
        ...createMonthlyBudgetHandlers({
          get: { error: true },
        }),
      ],
    },
  },
}

export const WithChart: Story = {
  args: { chart: <MonthlySpendingChart bookId={1} /> },
  parameters: { mockingDate: new Date(2025, 5, 15) },
}
