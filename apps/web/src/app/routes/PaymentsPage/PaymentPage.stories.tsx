import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { payments } from "../../../test/data/payments"
import { createStoryRouter, paymentsRouteBuilder } from "../../../test/helpers/routerDecorator"
import { createBookHandlers } from "../../../test/msw/handlers/books"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import type { PaymentRow } from "../../../types/payment"
import { PaymentsPage } from "./PaymentsPage"

const frequentPaymentRows = Array.from({ length: 5 }, (_candidate, candidateIndex) =>
  Array.from({ length: 3 }, (_occurrence, occurrenceIndex): PaymentRow => {
    const id = 100 + candidateIndex * 3 + occurrenceIndex
    const timestamp = "2025-06-15T00:00:00.000Z"

    return {
      id,
      note: `Candidate ${candidateIndex + 1}`,
      amount: 1000 + candidateIndex * 100,
      date: "2025-06-15",
      created_at: timestamp,
      updated_at: timestamp,
      book_id: 1,
      category_id: 10,
    }
  }),
).flat()

const meta = {
  title: "Pages/PaymentsPage",
  component: PaymentsPage,
  parameters: {
    mockingDate: new Date(2025, 5, 15),
    msw: {
      handlers: [
        ...createPaymentHandlers({
          initialRows: payments.map(mapPaymentToRow),
        }),
        ...createCategoryHandlers(),
        ...createMonthlyBudgetHandlers({
          get: { response: { ...monthlyBudgets[2], amount: 25000 } },
        }),
      ],
    },
  },
  tags: ["autodocs", "browser-test"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof PaymentsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  decorators: [createStoryRouter("/payments?year=2025&month=6", paymentsRouteBuilder)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    canvas.getByRole("button", { name: /create payment/i })

    expect(await canvas.findAllByText("コンビニ")).toHaveLength(2)
    expect(await canvas.findAllByRole("button", { name: /コンビニ/ })).toHaveLength(2)
    expect(canvas.queryByText("スーパー")).not.toBeInTheDocument()
    const paymentList = await canvas.findByLabelText("payment-list")
    expect(await within(paymentList).findByText("Jun 2, 2025")).toBeInTheDocument()
    expect(await within(paymentList).findByText("Jun 3, 2025")).toBeInTheDocument()
    expect(await within(paymentList).findByText("¥1,000")).toBeInTheDocument()
    expect(await within(paymentList).findByText("¥4,000")).toBeInTheDocument()
    expect(await canvas.findByText("¥20,000 left")).toBeInTheDocument()
  },
}

export const OpenDetails: Story = {
  args: {},
  decorators: [createStoryRouter("/payments/details/2?year=2025&month=6", paymentsRouteBuilder)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await canvas.findByText("Jun 3, 2025")
    const paymentList = await canvas.findByLabelText("payment-list")
    expect(await within(paymentList).findByText("Daily Necessities")).toBeInTheDocument()

    const detailDialog = await body.findByRole("dialog", {
      name: /payment details/i,
    })
    expect(await within(detailDialog).findByText("Daily Necessities")).not.toHaveClass("rt-Badge")
    expect(await within(detailDialog).findAllByText(/Date|Category|Note|Amount/)).toHaveLength(4)
    expect(await within(detailDialog).findByText("Category")).toBeInTheDocument()
    expect(await within(detailDialog).findByText("Jun 3, 2025")).toBeInTheDocument()
    expect(await within(detailDialog).findByText("Daily Necessities")).toBeInTheDocument()
    expect(await within(detailDialog).findByText("¥4,000")).toBeInTheDocument()
    expect(await within(detailDialog).findByRole("button", { name: /delete/i })).toBeInTheDocument()
  },
}

export const FrequentPaymentsOverflow: Story = {
  decorators: [createStoryRouter("/payments?year=2025&month=6", paymentsRouteBuilder)],
  parameters: {
    msw: {
      handlers: [
        ...createBookHandlers(),
        ...createPaymentHandlers({ initialRows: frequentPaymentRows }),
        ...createCategoryHandlers({ get: { paymentRows: frequentPaymentRows } }),
        ...createMonthlyBudgetHandlers({
          get: { response: { ...monthlyBudgets[2], amount: 25000 } },
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const document = canvasElement.ownerDocument
    const body = within(document.body)

    await userEvent.click(canvas.getByRole("button", { name: /create payment/i }))

    const dialog = await body.findByRole("dialog", { name: /create payment/i })
    const group = await within(dialog).findByRole("group", { name: "Frequent payments" })
    const candidates = within(group).getAllByRole("button", { name: /use frequent payment/i })
    const groupStyle = document.defaultView?.getComputedStyle(group)

    expect(candidates).toHaveLength(5)
    expect(groupStyle?.flexWrap).toBe("nowrap")
    expect(groupStyle?.overflowX).toBe("auto")
    expect(group.scrollWidth).toBeGreaterThan(group.clientWidth)

    group.scrollLeft = group.scrollWidth - group.clientWidth
    const lastCandidate = candidates[candidates.length - 1]

    await waitFor(() => {
      expect(lastCandidate?.getBoundingClientRect().right).toBeLessThanOrEqual(
        group.getBoundingClientRect().right + 1,
      )
    })
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    )
  },
}
