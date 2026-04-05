import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { AmountField } from "./AmountField"

const meta = {
  title: "Features/PaymentDetails/AmountField",
  component: AmountField,
  parameters: {
    msw: {
      handlers: createPaymentHandlers(),
    },
  },
  args: {
    paymentId: 1,
    amount: 1000,
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
} satisfies Meta<typeof AmountField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
