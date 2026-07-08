import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { payments } from "../../../test/data/payments"
import { createStoryRouter, paymentsRouteBuilder } from "../../../test/helpers/routerDecorator"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import { PaymentsPage } from "./PaymentsPage"

const meta = {
  title: "Pages/PaymentsPage",
  component: PaymentsPage,
  parameters: {
    mockingDate: new Date(2025, 5, 15),
    msw: {
      handlers: [
        ...createPaymentHandlers({
          initialRows: payments.map(mapPaymentToRow),
        }),
        ...createCategoryHandlers(),
        ...createMonthlyBudgetHandlers({
          get: { response: { ...monthlyBudgets[2], amount: 25000 } },
        }),
      ],
    },
  },
  tags: ["autodocs", "browser-test"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof PaymentsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  decorators: [createStoryRouter("/payments?year=2025&month=6", paymentsRouteBuilder)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    canvas.getByRole("button", { name: /create payment/i })

    expect(await canvas.findAllByText("コンビニ")).toHaveLength(2)
    expect(await canvas.findAllByRole("button", { name: /コンビニ/ })).toHaveLength(2)
    expect(canvas.queryByText("スーパー")).not.toBeInTheDocument()
    const paymentList = await canvas.findByLabelText("payment-list")
    expect(await within(paymentList).findByText("Jun 2, 2025")).toBeInTheDocument()
    expect(await within(paymentList).findByText("Jun 3, 2025")).toBeInTheDocument()
    expect(await within(paymentList).findByText("¥1,000")).toBeInTheDocument()
    expect(await within(paymentList).findByText("¥4,000")).toBeInTheDocument()
    expect(await canvas.findByText("¥20,000 left")).toBeInTheDocument()
  },
}

export const OpenDetails: Story = {
  args: {},
  decorators: [createStoryRouter("/payments/details/2?year=2025&month=6", paymentsRouteBuilder)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await canvas.findByText("Jun 3, 2025")
    const paymentList = await canvas.findByLabelText("payment-list")
    expect(await within(paymentList).findByText("Daily Necessities")).toBeInTheDocument()

    const detailDialog = await body.findByRole("dialog", {
      name: /payment details/i,
    })
    expect(await within(detailDialog).findByText("Daily Necessities")).not.toHaveClass("rt-Badge")
    expect(await within(detailDialog).findAllByText(/Date|Category|Note|Amount/)).toHaveLength(4)
    expect(await within(detailDialog).findByText("Category")).toBeInTheDocument()
    expect(await within(detailDialog).findByText("Jun 3, 2025")).toBeInTheDocument()
    expect(await within(detailDialog).findByText("Daily Necessities")).toBeInTheDocument()
    expect(await within(detailDialog).findByText("¥4,000")).toBeInTheDocument()
    expect(await within(detailDialog).findByRole("button", { name: /delete/i })).toBeInTheDocument()
  },
}
