import type { Meta, StoryObj } from "@storybook/react-vite"

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

export const Default: Story = {}
