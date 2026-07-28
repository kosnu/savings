import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ComponentProps } from "react"
import { fn } from "storybook/test"

import { toDateOnlyString } from "../../../../domain/date"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import type { PaymentRow } from "../../../../types/payment"
import { FrequentPaymentSuggestions } from "./FrequentPaymentSuggestions"

const today = toDateOnlyString(new Date())

function createPaymentRow(id: number, note: string, amount: number): PaymentRow {
  return {
    id,
    note,
    amount,
    date: today,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    book_id: 1,
    category_id: 10,
  }
}

const candidateRows = [
  createPaymentRow(100, "Lunch", 1200),
  createPaymentRow(101, "Lunch", 1200),
  createPaymentRow(102, "Lunch", 1200),
  createPaymentRow(103, "123456789012345678901234567890", 800),
  createPaymentRow(104, "123456789012345678901234567890", 800),
  createPaymentRow(105, "123456789012345678901234567890", 800),
]

const manyCandidateRows = Array.from({ length: 5 }, (_candidate, candidateIndex) =>
  Array.from({ length: 3 }, (_occurrence, occurrenceIndex) =>
    createPaymentRow(
      200 + candidateIndex * 3 + occurrenceIndex,
      `Candidate ${candidateIndex + 1}`,
      1000 + candidateIndex * 100,
    ),
  ),
).flat()

const onSelect: ComponentProps<typeof FrequentPaymentSuggestions>["onSelect"] = fn()

const meta = {
  title: "Features/Payments/CreatePayment/FrequentPaymentSuggestions",
  component: FrequentPaymentSuggestions,
  parameters: {
    layout: "centered",
    msw: {
      handlers: createPaymentHandlers({ get: { response: candidateRows } }),
    },
  },
  tags: ["autodocs"],
  args: {
    bookId: 1,
    onSelect,
  },
} satisfies Meta<typeof FrequentPaymentSuggestions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ManyCandidates: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: "20rem", maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    msw: {
      handlers: createPaymentHandlers({ get: { response: manyCandidateRows } }),
    },
  },
}

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: createPaymentHandlers({ get: { durationOrMode: "infinite" } }),
    },
  },
}

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: createPaymentHandlers({ get: { response: [] } }),
    },
  },
}

export const Error: Story = {
  parameters: {
    msw: {
      handlers: createPaymentHandlers({ get: { error: true } }),
    },
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}
