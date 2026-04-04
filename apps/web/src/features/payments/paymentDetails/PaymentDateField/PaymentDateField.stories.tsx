import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { PaymentDateField } from "./PaymentDateField"

const meta = {
  title: "Features/PaymentDetails/PaymentDateField",
  component: PaymentDateField,
  args: {
    date: new Date(2025, 5, 2),
  },
} satisfies Meta<typeof PaymentDateField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByText("Date")).toBeInTheDocument()
    expect(canvas.getByText("2025/06/02")).toBeInTheDocument()
  },
}
