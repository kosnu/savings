import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { expect, fn, userEvent, within } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar/SnackbarProvider"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { AmountField } from "./AmountField"

const meta = {
  title: "Features/Payments/PaymentDetails/AmountField",
  component: AmountField,
  parameters: {
    msw: {
      handlers: createPaymentHandlers(),
    },
  },
  args: {
    bookId: 1,
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
  args: {
    onEditStart: fn(),
    onEditEnd: fn(),
  },
}

export const Saving: Story = {
  args: { onEditStart: fn(), onEditEnd: fn() },
  parameters: {
    msw: { handlers: createPaymentHandlers({ update: { durationOrMode: "infinite" } }) },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole("button", { name: /edit amount/i }))
    const input = canvas.getByRole("textbox", { name: /amount/i })
    await userEvent.clear(input)
    await userEvent.type(input, "2500")
    await userEvent.click(canvas.getByRole("button", { name: /save amount/i }))
    await expect(canvas.getByRole("textbox", { name: /amount/i })).toBeDisabled()
  },
}

export const SaveError: Story = {
  args: { onEditStart: fn(), onEditEnd: fn() },
  parameters: { msw: { handlers: createPaymentHandlers({ update: { error: true } }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole("button", { name: /edit amount/i }))
    const input = canvas.getByRole("textbox", { name: /amount/i })
    await userEvent.clear(input)
    await userEvent.type(input, "2500")
    await userEvent.click(canvas.getByRole("button", { name: /save amount/i }))
    await expect(
      await body.findByText("Failed to update amount.", { selector: "span" }),
    ).toBeVisible()
  },
}
