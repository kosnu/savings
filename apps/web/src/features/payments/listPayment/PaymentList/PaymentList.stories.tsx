import type { Meta, StoryObj } from "@storybook/react-vite"
import { HttpResponse, delay, http } from "msw"
import { expect, within } from "storybook/test"

import { createStoryRouter, paymentsRouteBuilder } from "../../../../test/helpers/routerDecorator"
import { PaymentList } from "./PaymentList"

const paymentRestUrl = "*/rest/v1/payments*"

const meta = {
  title: "Features/ListPayment/PaymentList",
  component: PaymentList,
  parameters: {},
  tags: ["autodocs"],
  decorators: [createStoryRouter("/payments?year=2025&month=06", paymentsRouteBuilder) as never],
  argTypes: {},
  loaders: [
    async () => {
      const { worker } = await import("../../../../test/msw/browser")
      worker.resetHandlers()
    },
  ],
} satisfies Meta<typeof PaymentList>

export default meta
type Story = StoryObj<typeof meta>
type StoryPlayContext = Parameters<NonNullable<Story["play"]>>[0]

export const Default: Story = {
  args: {},
  play: async ({ canvasElement }: StoryPlayContext) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByLabelText("payment-list")).toBeInTheDocument()
    expect(await canvas.findAllByRole("button", { name: /コンビニ/ })).toHaveLength(2)
    expect(await canvas.findByText("Food")).toBeInTheDocument()
    expect(await canvas.findByText("Daily Necessities")).toBeInTheDocument()
  },
}

export const Loading: Story = {
  loaders: [
    async () => {
      const { worker } = await import("../../../../test/msw/browser")
      worker.use(
        http.get(paymentRestUrl, async () => {
          await delay("infinite")
          return HttpResponse.json([])
        }),
      )
    },
  ],
  play: async ({ canvasElement }: StoryPlayContext) => {
    const canvas = within(canvasElement)

    expect(await canvas.findAllByLabelText("loading-payment-item")).toHaveLength(3)
  },
}
