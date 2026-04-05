import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"

import { AmountField } from "./AmountField"

const meta = {
  title: "Features/CreatePayment/AmountField",
  component: AmountField,
  args: {},
  render: (args) => {
    const [amount, setAmount] = useState<number | undefined>(undefined)

    return <AmountField {...args} value={amount} onChange={setAmount} />
  },
} satisfies Meta<typeof AmountField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const HasError: Story = {
  args: {
    error: true,
    messages: ["This field is required"],
  },
}
