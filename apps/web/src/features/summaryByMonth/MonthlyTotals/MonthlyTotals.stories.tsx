import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { createStoryRouter, paymentsRouteBuilder } from "../../../test/helpers/routerDecorator"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { MonthlyTotals } from "./MonthlyTotals"

const meta = {
  title: "Features/SummaryByMonth/MonthlyTotals",
  component: MonthlyTotals,
  tags: ["autodocs"],
  parameters: {
    msw: {
      handlers: createPaymentHandlers({
        getMonthlyTotalAmount: { response: 10000 },
      }),
    },
  },
  decorators: [createStoryRouter("/payments?year=2025&month=06", paymentsRouteBuilder)],
} satisfies Meta<typeof MonthlyTotals>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByText("Total spending")).toBeInTheDocument()
    expect(await canvas.findByText("￥10,000")).toBeInTheDocument()
  },
}
