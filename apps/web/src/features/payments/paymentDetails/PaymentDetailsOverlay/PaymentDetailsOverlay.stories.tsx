import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, within } from "storybook/test"

import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { foodCat } from "../../../../test/data/categories"
import { payments } from "../../../../test/data/payments"
import { PaymentDetailsOverlay } from "./PaymentDetailsOverlay"

const meta = {
  title: "Features/PaymentDetails/PaymentDetailsOverlay",
  component: PaymentDetailsOverlay,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: fn(),
    onDelete: fn(),
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

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", { name: /payment details/i })

    expect(within(dialog).getByRole("button", { name: /delete/i })).toBeInTheDocument()
  },
}

export const EmptyNote: Story = {
  args: {
    payment: {
      ...payments[0],
      note: "",
    },
  },
}
