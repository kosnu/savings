import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { AmountField } from "./AmountField"

const meta = {
  title: "Features/PaymentDetails/AmountField",
  component: AmountField,
  args: {
    amount: 1000,
  },
} satisfies Meta<typeof AmountField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByText("Amount")).toBeInTheDocument()
    expect(canvas.getByText(/1,000/)).toBeInTheDocument()
  },
}
