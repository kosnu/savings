import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"

import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { foodCat } from "../../../../test/data/categories"
import { payments } from "../../../../test/data/payments"
import { PaymentDetailsOverlay } from "./PaymentDetailsOverlay"

const meta = {
  title: "Features/ListPayment/PaymentDetailsOverlay",
  component: PaymentDetailsOverlay,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: fn(),
    category: foodCat,
    payment: payments[0],
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof PaymentDetailsOverlay>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const EmptyNote: Story = {
  args: {
    payment: {
      ...payments[0],
      note: "",
    },
  },
}
