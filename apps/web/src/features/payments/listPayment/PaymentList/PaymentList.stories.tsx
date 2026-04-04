import type { Meta, StoryObj } from "@storybook/react-vite"

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

export const Default: Story = {
  args: {},
  parameters: {
    msw: {
      handlers: [...createPaymentHandlers(), ...createCategoryHandlers()],
    },
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
}
