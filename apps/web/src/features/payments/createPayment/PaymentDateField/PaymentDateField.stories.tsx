import type { Meta, StoryObj } from "@storybook/react-vite"

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
}

export const HasError: Story = {
  args: {
    error: true,
    messages: ["日付が未選択です", "1年以上前の日付は選択できません"],
  },
}
