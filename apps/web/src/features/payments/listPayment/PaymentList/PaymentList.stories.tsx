import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { createStoryRouter, paymentsRouteBuilder } from "../../../../test/helpers/routerDecorator"
import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { PaymentList } from "./PaymentList"

const meta = {
  title: "Features/ListPayment/PaymentList",
  component: PaymentList,
  parameters: {},
  tags: ["autodocs"],
  decorators: [createStoryRouter("/payments?year=2025&month=06", paymentsRouteBuilder)],
  argTypes: {},
} satisfies Meta<typeof PaymentList>

export default meta
type Story = StoryObj<typeof meta>
type StoryPlayContext = Parameters<NonNullable<Story["play"]>>[0]

export const Default: Story = {
  args: {},
  parameters: {
    msw: {
      handlers: [...createPaymentHandlers(), ...createCategoryHandlers()],
    },
  },
  play: async ({ canvasElement }: StoryPlayContext) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByLabelText("payment-list")).toBeInTheDocument()
    expect(await canvas.findAllByRole("button", { name: /コンビニ/ })).toHaveLength(2)
    expect(await canvas.findByText("Food")).toBeInTheDocument()
    expect(await canvas.findByText("Daily Necessities")).toBeInTheDocument()
  },
}

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers({
          get: { response: [], error: false, durationOrMode: "infinite" },
        }),
        ...createCategoryHandlers(),
      ],
    },
  },
  play: async ({ canvasElement }: StoryPlayContext) => {
    const canvas = within(canvasElement)

    expect(await canvas.findAllByLabelText("loading-payment-item")).toHaveLength(3)
  },
}
