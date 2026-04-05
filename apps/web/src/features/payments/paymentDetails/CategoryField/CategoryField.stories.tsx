import type { Meta, StoryObj } from "@storybook/react-vite"

import { CategoryField } from "./CategoryField"

const meta = {
  title: "Features/PaymentDetails/CategoryField",
  component: CategoryField,
  args: {
    categoryName: "Food",
  },
} satisfies Meta<typeof CategoryField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
