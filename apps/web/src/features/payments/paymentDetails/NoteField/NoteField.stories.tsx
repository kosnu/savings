import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { fn } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { NoteField } from "./NoteField"

const meta = {
  title: "Features/PaymentDetails/NoteField",
  component: NoteField,
  parameters: {
    msw: {
      handlers: createPaymentHandlers(),
    },
  },
  args: {
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
