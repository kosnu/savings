import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor, within } from "storybook/test"

import { createStoryRouter, paymentsRouteBuilder } from "../../../test/helpers/routerDecorator"
import { resetPaymentState } from "../../../test/msw/handlers/payments"
import { PaymentsPage } from "./PaymentsPage"

const meta = {
  title: "Pages/PaymentsPage",
  component: PaymentsPage,
  parameters: {
    mockingDate: new Date(2025, 5, 15),
  },
  tags: ["autodocs"],
  decorators: [createStoryRouter("/payments?year=2025&month=6", paymentsRouteBuilder)],
  loaders: [
    async () => {
      resetPaymentState()

      const { worker } = await import("../../../test/msw/browser")
      worker.resetHandlers()
    },
  ],
  argTypes: {},
  args: {},
} satisfies Meta<typeof PaymentsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    canvas.getByRole("button", { name: /create payment/i })

    expect(await canvas.findAllByText("コンビニ")).toHaveLength(2)
    expect(await canvas.findAllByRole("button", { name: /コンビニ/ })).toHaveLength(2)
    expect(canvas.queryByText("スーパー")).not.toBeInTheDocument()
    expect(await canvas.findByText("2025/06/01")).toBeInTheDocument()
    expect(await canvas.findByText("2025/06/02")).toBeInTheDocument()
    expect(await canvas.findByText("￥4,000")).toBeInTheDocument()
    expect(await canvas.findByText("￥1,000")).toBeInTheDocument()
  },
}

export const OpenDetails: Story = {
  args: {},
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await canvas.findByText("2025/06/02")
    expect(await canvas.findByText("Daily Necessities")).toBeInTheDocument()

    const paymentButtons = await canvas.findAllByRole("button", { name: /コンビニ/ })
    const paymentButton = paymentButtons[0]
    await userEvent.click(paymentButton)

    const detailDialog = await body.findByRole("dialog", {
      name: /payment details/i,
    })
    expect(within(detailDialog).getByText("Daily Necessities")).not.toHaveClass("rt-Badge")
    expect(within(detailDialog).getAllByText(/Date|Category|Note|Amount/)).toHaveLength(4)
    expect(within(detailDialog).getByText("Category")).toBeInTheDocument()
    expect(within(detailDialog).getByText("2025/06/02")).toBeInTheDocument()
    expect(within(detailDialog).getByText("Daily Necessities")).toBeInTheDocument()
    expect(within(detailDialog).getByText("￥4,000")).toBeInTheDocument()
    expect(within(detailDialog).getByRole("button", { name: /delete/i })).toBeInTheDocument()
  },
}

export const DeleteFromDetails: Story = {
  args: {},
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await canvas.findByText("2025/06/02")
    const paymentButton = (await canvas.findAllByRole("button", { name: /コンビニ/ }))[0]
    await userEvent.click(paymentButton)

    const detailDialog = await body.findByRole("dialog", {
      name: /payment details/i,
    })
    const deleteButton = within(detailDialog).getByRole("button", { name: /delete/i })
    await userEvent.click(deleteButton)

    const deleteDialog = await body.findByRole("dialog", {
      name: /delete/i,
    })
    await userEvent.click(within(deleteDialog).getByRole("button", { name: /^delete$/i }))

    await waitFor(() => {
      expect(body.queryByRole("dialog", { name: /payment details/i })).not.toBeInTheDocument()
      expect(body.queryByRole("dialog", { name: /delete/i })).not.toBeInTheDocument()
    })

    expect(await canvas.findAllByRole("button", { name: /コンビニ/ })).toHaveLength(1)
    expect(await canvas.findByText("￥6,000")).toBeInTheDocument()
  },
}
