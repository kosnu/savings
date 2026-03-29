import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { expect, fn, userEvent } from "storybook/test"

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
    onClose: fn(),
    onSuccess: fn(),
  },
} satisfies Meta<typeof DeletePaymentModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    payment: payments[0],
  },
}

export const LongInfo: Story = {
  args: {
    open: true,
    payment: longPayment,
  },
}

export const NoPayment: Story = {
  args: {
    open: true,
    payment: undefined,
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)

    expect(body.getByText("Payment not found.")).toBeInTheDocument()

    const disabledDeleteButton = body.getByRole("button", { name: /delete/i })
    expect(disabledDeleteButton).toBeDisabled()
  },
}

export const ClickDeleteButton: Story = {
  args: {
    open: true,
    payment: payments[0],
  },
  parameters: {
    msw: {
      handlers: createPaymentHandlers({
        delete: { response: payments[0] },
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", { name: /delete this payment/i })
    expect(dialog).toBeInTheDocument()

    const deleteButton = within(dialog).getByRole("button", {
      name: /delete/i,
    })
    await userEvent.click(deleteButton)

    const successMessage = await body.findByText("Payment deleted successfully.")
    expect(successMessage).toBeInTheDocument()
  },
}

export const DeleteFailureKeepsDialogOpen: Story = {
  args: {
    open: true,
    payment: payments[0],
  },
  parameters: {
    msw: {
      handlers: createPaymentHandlers({
        delete: { error: true },
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", { name: /delete this payment/i })
    await userEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }))

    const errorMessage = await body.findByText("Failed to delete payment.")
    expect(errorMessage).toBeInTheDocument()
    expect(body.getByRole("dialog", { name: /delete this payment/i })).toBeInTheDocument()
  },
}
