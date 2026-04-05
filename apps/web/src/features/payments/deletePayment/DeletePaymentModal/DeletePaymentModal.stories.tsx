import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { fn } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { longPayment, payments } from "../../../../test/data/payments"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { DeletePaymentModal } from "./DeletePaymentModal"

const meta = {
  title: "Features/DeletePayment/DeletePaymentModal",
  component: DeletePaymentModal,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    open: true,
    payment: payments[0],
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
} satisfies Meta<typeof DeletePaymentModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onClose: fn(),
    onSuccess: fn(),
  },
  parameters: {
    msw: {
      handlers: createPaymentHandlers(),
    },
  },
}

export const LongInfo: Story = {
  args: {
    onClose: fn(),
    onSuccess: fn(),
    payment: longPayment,
  },
}

export const NoPayment: Story = {
  args: {
    onClose: fn(),
    onSuccess: fn(),
    payment: undefined,
  },
}

export const ClickDeleteButton: Story = {
  args: {
    onClose: fn(),
    onSuccess: fn(),
  },
  parameters: {
    msw: {
      handlers: createPaymentHandlers({
        delete: { response: payments[0] },
      }),
    },
  },
}

export const DeleteFailureKeepsDialogOpen: Story = {
  args: {
    onClose: fn(),
    onSuccess: fn(),
  },
  parameters: {
    msw: {
      handlers: createPaymentHandlers({
        delete: { error: true },
      }),
    },
  },
}
