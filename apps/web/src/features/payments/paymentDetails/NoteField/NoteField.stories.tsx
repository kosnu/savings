import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { expect, fn, userEvent, within } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar/SnackbarProvider"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { NoteField } from "./NoteField"

const meta = {
  title: "Features/Payments/PaymentDetails/NoteField",
  component: NoteField,
  parameters: {
    msw: {
      handlers: createPaymentHandlers(),
    },
  },
  args: {
    bookId: 1,
    paymentId: 1,
    note: "コンビニ",
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
} satisfies Meta<typeof NoteField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onEditStart: fn(),
    onEditEnd: fn(),
  },
}

export const EmptyNote: Story = {
  args: {
    note: "",
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

    await userEvent.click(canvas.getByRole("button", { name: /edit note/i }))
    const input = canvas.getByRole("textbox", { name: /note/i })
    await userEvent.clear(input)
    await userEvent.type(input, "Updated note")
    await userEvent.click(canvas.getByRole("button", { name: /save note/i }))
    await expect(canvas.getByRole("textbox", { name: /note/i })).toBeDisabled()
  },
}

export const SaveError: Story = {
  args: { onEditStart: fn(), onEditEnd: fn() },
  parameters: { msw: { handlers: createPaymentHandlers({ update: { error: true } }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole("button", { name: /edit note/i }))
    const input = canvas.getByRole("textbox", { name: /note/i })
    await userEvent.clear(input)
    await userEvent.type(input, "Updated note")
    await userEvent.click(canvas.getByRole("button", { name: /save note/i }))
    await expect(
      await body.findByText("Failed to update note.", { selector: "span" }),
    ).toBeVisible()
  },
}
