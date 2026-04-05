import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"

import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { CreatePaymentForm } from "./CreatePaymentForm"

const meta = {
  title: "Features/CreatePayment/CreatePaymentForm",
  component: CreatePaymentForm,
  parameters: {
    layout: "centered",
    msw: {
      handlers: createCategoryHandlers(),
    },
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onCancel: fn(),
  },
  decorators: (Story) => {
    return (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    )
  },
} satisfies Meta<typeof CreatePaymentForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onSuccess: fn(),
  },
}
