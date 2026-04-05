import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"

import { AmountInput } from "./AmountInput"

const meta = {
  title: "Features/Payments/Components/AmountInput",
  component: AmountInput,
  parameters: {
    layout: "centered",
  },
  render: (args) => {
    const [amount, setAmount] = useState<number | undefined>(args.value)

    return <AmountInput {...args} value={amount} onChange={setAmount} />
  },
} satisfies Meta<typeof AmountInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Filled: Story = {
  args: {
    value: 1200,
  },
}
