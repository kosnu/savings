import type { Meta, StoryObj } from "@storybook/react"
import { expect, within } from "storybook/test"
import { PaymentDateField } from "./PaymentDateField"

const meta: Meta<typeof PaymentDateField> = {
  title: "Features/CreatePayment/PaymentDateField",
  component: PaymentDateField,
}
export default meta

type Story = StoryObj<typeof PaymentDateField>

export const Default: Story = {
  args: {
    message: "日付を選択してください",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText("Date")).toBeInTheDocument()
    expect(canvas.getByText("日付を選択してください")).toBeInTheDocument()
    expect(canvas.getByRole("button")).toBeInTheDocument()
  },
}
