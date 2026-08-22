import type { Meta, StoryObj } from "@storybook/react-vite"

import { categoryHandlers } from "../../../../test/msw/handlers/categories"
import { CategoryField } from "./CategoryField"

const meta = {
  title: "Features/Payments/CreatePayment/CategoryField",
  component: CategoryField,
  parameters: {
    layout: "centered",
    msw: {
      handlers: categoryHandlers,
    },
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof CategoryField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}
