import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { expect, within } from "storybook/test"

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

export const Default: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)

    const input = canvas.getByRole("textbox")
    await userEvent.type(input, "1000")

    expect(input).toHaveValue("1000")
  },
}

export const Filled: Story = {
  args: {
    value: 1200,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByRole("textbox")).toHaveValue("1200")
  },
}
