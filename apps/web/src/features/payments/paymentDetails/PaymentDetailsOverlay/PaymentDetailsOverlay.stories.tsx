import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { expect, fn, within } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { foodCat } from "../../../../test/data/categories"
import { payments } from "../../../../test/data/payments"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { PaymentDetailsOverlay } from "./PaymentDetailsOverlay"

const meta = {
  title: "Features/PaymentDetails/PaymentDetailsOverlay",
  component: PaymentDetailsOverlay,
  parameters: {
    layout: "centered",
    msw: {
      handlers: createPaymentHandlers(),
    },
  },
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: fn(),
    onDelete: fn(),
    category: foodCat,
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
} satisfies Meta<typeof PaymentDetailsOverlay>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", { name: /payment details/i })

    expect(within(dialog).getByRole("button", { name: /delete/i })).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: /edit amount/i })).toBeInTheDocument()
  },
}

export const EmptyNote: Story = {
  args: {
    payment: {
      ...payments[0],
      note: "",
    },
  },
}
