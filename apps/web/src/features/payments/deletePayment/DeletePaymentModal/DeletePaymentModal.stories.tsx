import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar/SnackbarProvider"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { longPayment, payments } from "../../../../test/data/payments"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { DeletePaymentModal } from "./DeletePaymentModal"

const meta = {
  title: "Features/Payments/DeletePayment/DeletePaymentModal",
  component: DeletePaymentModal,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    bookId: 1,
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
  play: async () => {
    const body = within(document.body)
    await userEvent.click(body.getByRole("button", { name: /^delete$/i }))
    await expect(await body.findByText("Failed to delete payment.")).toBeVisible()
    await waitFor(async () => expect(body.getByRole("dialog")).toBeVisible())
  },
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

export const Deleting: Story = {
  args: { onClose: fn(), onSuccess: fn() },
  parameters: {
    msw: { handlers: createPaymentHandlers({ delete: { durationOrMode: "infinite" } }) },
  },
  play: async () => {
    const body = within(document.body)
    const submitButton = body.getByRole("button", { name: /^delete$/i })
    await userEvent.click(submitButton)
    await expect(submitButton).toBeDisabled()
  },
}
