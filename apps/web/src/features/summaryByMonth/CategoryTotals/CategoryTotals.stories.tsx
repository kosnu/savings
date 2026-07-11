import { Box } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

import { createStoryRouter, paymentsRouteBuilder } from "../../../test/helpers/routerDecorator"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import type { CategoryRow } from "../../../types/category"
import type { PaymentRow } from "../../../types/payment"
import { CategoryTotals } from "./CategoryTotals"

const categoryRows: CategoryRow[] = [
  {
    id: 10,
    book_id: 1,
    name: "On budget",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: 20,
    book_id: 1,
    name: "Left",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: 30,
    book_id: 1,
    name: "Over",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: 40,
    book_id: 1,
    name: "Not set",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: 50,
    book_id: 1,
    name: "No budget",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
]

const paymentRows: PaymentRow[] = [
  {
    id: 10,
    book_id: 1,
    category_id: 10,
    amount: 1000,
    date: "2025-06-02",
    note: "On budget",
    created_at: "2025-06-02T00:00:00.000Z",
    updated_at: "2025-06-02T00:00:00.000Z",
  },
  {
    id: 20,
    book_id: 1,
    category_id: 20,
    amount: 1000,
    date: "2025-06-03",
    note: "Left",
    created_at: "2025-06-03T00:00:00.000Z",
    updated_at: "2025-06-03T00:00:00.000Z",
  },
  {
    id: 30,
    book_id: 1,
    category_id: 30,
    amount: 2500,
    date: "2025-06-04",
    note: "Over",
    created_at: "2025-06-04T00:00:00.000Z",
    updated_at: "2025-06-04T00:00:00.000Z",
  },
  {
    id: 40,
    book_id: 1,
    category_id: 40,
    amount: 1200,
    date: "2025-06-05",
    note: "Not set",
    created_at: "2025-06-05T00:00:00.000Z",
    updated_at: "2025-06-05T00:00:00.000Z",
  },
  {
    id: 50,
    book_id: 1,
    category_id: 50,
    amount: 800,
    date: "2025-06-06",
    note: "No budget",
    created_at: "2025-06-06T00:00:00.000Z",
    updated_at: "2025-06-06T00:00:00.000Z",
  },
]

const largeAmountCategoryRows: CategoryRow[] = [
  {
    id: 60,
    book_id: 1,
    name: "Large amount",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
]

const largeAmountPaymentRows: PaymentRow[] = [
  {
    id: 60,
    book_id: 1,
    category_id: 60,
    amount: 9_000_000_000_000,
    date: "2025-06-06",
    note: "Large amount",
    created_at: "2025-06-06T00:00:00.000Z",
    updated_at: "2025-06-06T00:00:00.000Z",
  },
]

const meta = {
  title: "Features/SummaryByMonth/CategoryTotals",
  component: CategoryTotals,
  tags: ["autodocs"],
  parameters: {
    msw: {
      handlers: [
        ...createCategoryHandlers({
          get: {
            response: categoryRows,
            paymentRows,
            budgetRows: [
              { category_id: 10, status: "amount", amount: 1000 },
              { category_id: 20, status: "amount", amount: 3000 },
              { category_id: 30, status: "amount", amount: 2000 },
              { category_id: 50, status: "none", amount: null },
            ],
          },
        }),
        ...createPaymentHandlers({ initialRows: paymentRows }),
      ],
    },
  },
  decorators: [createStoryRouter("/payments?year=2025&month=06", paymentsRouteBuilder)],
} satisfies Meta<typeof CategoryTotals>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByText("On budget")).toBeInTheDocument()
    expect(await canvas.findByText("¥2,000 left")).toBeInTheDocument()
    expect(await canvas.findByText("¥500 over")).toBeInTheDocument()

    await userEvent.click(await canvas.findByRole("button", { name: "Show more category totals" }))

    expect(await canvas.findByText("Not set")).toBeInTheDocument()
    expect(await canvas.findByText("No budget")).toBeInTheDocument()
  },
}

export const LargeAmounts: Story = {
  tags: ["browser-test"],
  decorators: [
    (Story) => (
      <Box data-testid="large-amount-summary" style={{ width: "14rem" }}>
        <Story />
      </Box>
    ),
  ],
  parameters: {
    msw: {
      handlers: [
        ...createCategoryHandlers({
          get: {
            response: largeAmountCategoryRows,
            paymentRows: largeAmountPaymentRows,
            budgetRows: [{ category_id: 60, status: "amount", amount: 1 }],
          },
        }),
        ...createPaymentHandlers({ initialRows: largeAmountPaymentRows }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const container = await canvas.findByTestId("large-amount-summary")
    const progress = await canvas.findByRole("progressbar", {
      name: "Large amount budget progress",
    })

    expect(await canvas.findByText("¥9,000,000,000,000")).toBeInTheDocument()
    expect(await canvas.findByText("¥8,999,999,999,999 over")).toBeInTheDocument()
    expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth)
    expect(progress.getBoundingClientRect().width).toBe(container.getBoundingClientRect().width)
  },
}
