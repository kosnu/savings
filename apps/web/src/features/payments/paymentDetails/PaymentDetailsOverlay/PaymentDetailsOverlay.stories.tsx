import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { fn } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { payments } from "../../../../test/data/payments"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { mapPaymentToRow } from "../../../../test/utils/mapPaymentToRow"
import { PaymentDetailsOverlay } from "./PaymentDetailsOverlay"

const paymentId = payments[0].id!

const meta = {
  title: "Features/PaymentDetails/PaymentDetailsOverlay",
  component: PaymentDetailsOverlay,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: fn(),
    onDelete: fn(),
    paymentId,
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
} satisfies Meta<typeof PaymentDetailsOverlay>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: {
    msw: {
      handlers: createPaymentHandlers(),
    },
  },
}

export const EmptyNote: Story = {
  parameters: {
    msw: {
      handlers: createPaymentHandlers({
        initialRows: [
          mapPaymentToRow({
            ...payments[0],
            note: "",
          }),
          ...payments.slice(1).map(mapPaymentToRow),
        ],
      }),
    },
  },
}

export const MissingPayment: Story = {
  args: {
    paymentId: 9999,
  },
  parameters: {
    msw: {
      handlers: createPaymentHandlers(),
    },
  },
}
