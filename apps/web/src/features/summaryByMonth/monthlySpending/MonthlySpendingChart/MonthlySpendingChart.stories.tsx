import type { Meta, StoryObj } from "@storybook/react-vite"
import { delay, http, HttpResponse } from "msw"

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

export const HistoryLoading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/rest/v1/payments", async ({ request }) => {
          if (!new URL(request.url).searchParams.getAll("date").includes("gte.2025-05-01")) return
          await delay("infinite")
        }),
        ...createPaymentHandlers(),
        ...createMonthlyBudgetHandlers(),
      ],
    },
  },
}

export const HistoryError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/rest/v1/payments", ({ request }) => {
          if (!new URL(request.url).searchParams.getAll("date").includes("gte.2025-05-01")) return
          return HttpResponse.json({ message: "Failed to fetch history." }, { status: 500 })
        }),
        ...createPaymentHandlers(),
        ...createMonthlyBudgetHandlers(),
      ],
    },
  },
}
