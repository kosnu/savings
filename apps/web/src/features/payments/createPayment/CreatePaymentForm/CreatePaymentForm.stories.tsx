import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"

import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createBookHandlers } from "../../../../test/msw/handlers/books"
import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { CreatePaymentForm } from "./CreatePaymentForm"

const meta = {
  title: "Features/Payments/CreatePayment/CreatePaymentForm",
  component: CreatePaymentForm,
  parameters: {
    layout: "centered",
    msw: {
      handlers: [...createBookHandlers(), ...createPaymentHandlers(), ...createCategoryHandlers()],
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
