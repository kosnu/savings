import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"

import { foodCat } from "../../../../test/data/categories"
import { payments } from "../../../../test/data/payments"
import { PaymentItem } from "./PaymentItem"

const meta = {
  title: "Features/ListPayment/PaymentItem",
  component: PaymentItem,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
} satisfies Meta<typeof PaymentItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    payment: payments[0],
    category: foodCat,
    onOpen: fn(),
  },
}
