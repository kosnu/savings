import type { Meta, StoryObj } from "@storybook/react-vite"
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
    expect(canvas.getByRole("textbox")).toBeInTheDocument()
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
    const message = canvas.getByText((_, element) => {
      return element?.textContent === "日付が未選択です1年以上前の日付は選択できません"
    })
    expect(message).toHaveTextContent("日付が未選択です")
    expect(message).toHaveTextContent("1年以上前の日付は選択できません")
    expect(canvas.getByRole("textbox")).toBeInTheDocument()
  },
}
