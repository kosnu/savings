import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { expect, fn, userEvent, within } from "storybook/test"

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
    bookId: 1,
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

export const Saving: Story = {
  args: { onEditStart: fn(), onEditEnd: fn() },
  parameters: {
    msw: { handlers: createPaymentHandlers({ update: { durationOrMode: "infinite" } }) },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole("button", { name: /edit date/i }))
    await userEvent.click(await body.findByRole("button", { name: /^Tuesday, June 3rd, 2025$/i }))
    await expect(canvas.getByRole("textbox", { name: /date/i })).toBeDisabled()
  },
}

export const SaveError: Story = {
  args: { onEditStart: fn(), onEditEnd: fn() },
  parameters: { msw: { handlers: createPaymentHandlers({ update: { error: true } }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole("button", { name: /edit date/i }))
    await userEvent.click(await body.findByRole("button", { name: /^Tuesday, June 3rd, 2025$/i }))
    await expect(
      await body.findByText("Failed to update date.", { selector: "span" }),
    ).toBeVisible()
  },
}
