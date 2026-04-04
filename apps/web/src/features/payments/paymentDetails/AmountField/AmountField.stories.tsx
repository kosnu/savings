import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { expect, userEvent, within } from "storybook/test"

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

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByText("Amount")).toBeInTheDocument()
    expect(canvas.getByText(/1,000/)).toBeInTheDocument()
    expect(canvas.getByRole("button", { name: /edit amount/i })).toBeInTheDocument()
  },
}

export const Editing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole("button", { name: /edit amount/i }))
    expect(canvas.getByRole("textbox", { name: /amount/i })).toBeInTheDocument()
  },
}
