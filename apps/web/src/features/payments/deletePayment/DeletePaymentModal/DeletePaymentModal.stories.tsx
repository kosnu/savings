import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"

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
} satisfies Meta<typeof DeletePaymentModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    open: true,
    onClose: fn(),
    onSuccess: fn(),
    payment: payments[0],
  },
}

export const LongInfo: Story = {
  args: {
    open: true,
    onClose: fn(),
    onSuccess: fn(),
    payment: longPayment,
  },
}

export const NoPayment: Story = {
  args: {
    open: true,
    onClose: fn(),
    onSuccess: fn(),
    payment: undefined,
  },
}

export const ClickDeleteButton: Story = {
  args: {
    open: true,
    onClose: fn(),
    onSuccess: fn(),
    payment: payments[0],
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
    open: true,
    onClose: fn(),
    onSuccess: fn(),
    payment: payments[0],
  },
  parameters: {
    msw: {
      handlers: createPaymentHandlers({
        delete: { error: true },
      }),
    },
  },
}
