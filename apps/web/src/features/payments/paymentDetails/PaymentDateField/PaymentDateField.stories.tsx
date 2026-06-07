import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { fn } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar/SnackbarProvider"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { PaymentDateField } from "./PaymentDateField"

const meta = {
  title: "Features/Payments/PaymentDetails/PaymentDateField",
  component: PaymentDateField,
  parameters: {
    layout: "centered",
    mockingDate: new Date(2025, 5, 2),
    msw: {
      handlers: createPaymentHandlers(),
    },
  },
  args: {
    paymentId: 1,
    date: new Date(2025, 5, 2),
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={createQueryClient()}>
        <ThemeProvider>
          <SnackbarProvider>
            <Story />
          </SnackbarProvider>
        </ThemeProvider>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof PaymentDateField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onEditStart: fn(),
    onEditEnd: fn(),
  },
}
