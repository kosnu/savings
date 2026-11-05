import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

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

export const SpendingLoading: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers({ getMonthlyTotalAmount: { durationOrMode: "infinite" } }),
        ...createMonthlyBudgetHandlers({ get: { response: monthlyBudgets[2] } }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByTestId("skeleton")).toBeVisible()
  },
}

export const SpendingError: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers({ getMonthlyTotalAmount: { error: true } }),
        ...createMonthlyBudgetHandlers({ get: { response: monthlyBudgets[2] } }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Failed", {}, { timeout: 5000 })).toBeVisible()
  },
}

export const BudgetLoading: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers({ getMonthlyTotalAmount: { response: 10000 } }),
        ...createMonthlyBudgetHandlers({ get: { durationOrMode: "infinite" } }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByTestId("budget-difference-skeleton")).toBeVisible()
    await expect(await canvas.findByText("¥10,000")).toBeVisible()
  },
}

export const BudgetError: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers({ getMonthlyTotalAmount: { response: 10000 } }),
        ...createMonthlyBudgetHandlers({ get: { error: true } }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Failed", {}, { timeout: 5000 })).toBeVisible()
    await expect(await canvas.findByText("¥10,000")).toBeVisible()
  },
}
