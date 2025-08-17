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
    messages: ["日付を選択してください"],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText("Date")).toBeInTheDocument()
    expect(canvas.getByText("日付を選択してください")).toBeInTheDocument()
    expect(canvas.getByRole("button")).toBeInTheDocument()
  },
}

export const HasError: Story = {
  args: {
    error: true,
    messages: ["日付が未選択です", "1年以上前の日付は選択できません"],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText("Date")).toBeInTheDocument()
    expect(canvas.getByText("日付が未選択です")).toBeInTheDocument()
    expect(
      canvas.getByText("1年以上前の日付は選択できません"),
    ).toBeInTheDocument()
    expect(canvas.getByRole("button")).toBeInTheDocument()
  },
}
