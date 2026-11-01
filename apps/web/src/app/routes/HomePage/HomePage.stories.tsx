import type { Meta, StoryObj } from "@storybook/react-vite"
import { createRoute } from "@tanstack/react-router"
import { expect, waitFor, within } from "storybook/test"

import { paymentsSearchSchema } from "../../../features/payments"
import { SupabaseSessionContext } from "../../../providers/supabase/SupabaseSessionProvider"
import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { payments as samplePayments } from "../../../test/data/payments"
import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { createBookHandlers } from "../../../test/msw/handlers/books"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import { PaymentsPage } from "../PaymentsPage"
import { HomePage } from "./HomePage"

const meta = {
  title: "Pages/HomePage",
  component: HomePage,
  tags: ["autodocs", "browser-test"],
  decorators: [
    createStoryRouter("/?year=2025&month=6", (root, Story) => {
      const home = createRoute({
        getParentRoute: () => root,
        path: "/",
        component: Story,
        validateSearch: paymentsSearchSchema.pick({ year: true, month: true }),
      })
      const payments = createRoute({
        getParentRoute: () => root,
        path: "/payments",
        component: PaymentsPage,
        validateSearch: paymentsSearchSchema,
      })
      const details = createRoute({ getParentRoute: () => payments, path: "details/$paymentId" })
      return [home, payments.addChildren([details])]
    }),
  ],
  parameters: {
    mockingDate: new Date(2025, 5, 15),
    msw: {
      handlers: [
        ...createBookHandlers(),
        ...createPaymentHandlers(),
        ...createCategoryHandlers(),
        ...createMonthlyBudgetHandlers({
          get: { response: { ...monthlyBudgets[2], amount: 25000 } },
        }),
      ],
    },
  },
} satisfies Meta<typeof HomePage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    await expect(await canvas.findByLabelText("Total spending")).toBeVisible()
    await expect(
      await canvas.findByRole("progressbar", { name: "Food budget progress" }),
    ).toHaveAttribute("aria-valuenow", "1000")
    const recent = await canvas.findByLabelText("Recent payments")
    await expect(await within(recent).findAllByRole("button")).toHaveLength(4)
    await expect(canvas.getByRole("button", { name: "Create payment" })).toBeVisible()
    await expect(
      canvas.queryByRole("combobox", { name: "Category filter" }),
    ).not.toBeInTheDocument()
  },
}
export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createBookHandlers(),
        ...createPaymentHandlers({ initialRows: [] }),
        ...createCategoryHandlers({ get: { paymentRows: [] } }),
        ...createMonthlyBudgetHandlers(),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("No payments yet. Use “Create payment” to record one."),
    ).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Create payment" })).toBeEnabled()
  },
}
export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createBookHandlers({ durationOrMode: "infinite" }),
        ...createPaymentHandlers(),
        ...createCategoryHandlers(),
        ...createMonthlyBudgetHandlers(),
      ],
    },
  },
}
export const Error: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createBookHandlers({ error: true }),
        ...createPaymentHandlers(),
        ...createCategoryHandlers(),
        ...createMonthlyBudgetHandlers(),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("alert", {}, { timeout: 5000 }),
    ).toHaveTextContent("Failed")
  },
}
export const Unauthenticated: Story = {
  decorators: [
    (Story) => (
      <SupabaseSessionContext value={{ status: "unauthenticated", session: null }}>
        <Story />
      </SupabaseSessionContext>
    ),
  ],
}
export const RestoringSession: Story = {
  decorators: [
    (Story) => (
      <SupabaseSessionContext value={{ status: "loading", session: null }}>
        <Story />
      </SupabaseSessionContext>
    ),
  ],
}

function loadingTransitionStory(count: number, mobile = false): Story {
  const rows = Array.from({ length: count }, (_, index) => ({
    ...mapPaymentToRow(samplePayments[0]),
    id: index + 1,
    category_id: 10 + index,
    note: `Payment ${index + 1}`,
  }))
  const categories = rows.map((row) => ({
    id: row.category_id,
    book_id: 1,
    name:
      mobile && count === 5
        ? `あいうえおかきくけこさしすせそたちつて${row.id}`
        : `Category ${row.id}`,
    created_at: "2025-01-01",
    updated_at: "2025-01-01",
  }))

  return {
    parameters: {
      viewport: {
        options: {
          desktop: { name: "Desktop", styles: { width: "1280px", height: "900px" } },
          mobile: { name: "Mobile", styles: { width: "320px", height: "568px" } },
        },
      },
      msw: {
        handlers: [
          ...createBookHandlers({ durationOrMode: 500 }),
          ...createPaymentHandlers({
            initialRows: rows,
            get: { durationOrMode: 700 },
            getMonthlyTotalAmount: { durationOrMode: 1000 },
          }),
          ...createCategoryHandlers({
            get: {
              response: categories,
              paymentRows: rows,
              budgetRows: categories.map((category) => ({
                category_id: category.id,
                status: "amount" as const,
                amount: 30000,
              })),
              durationOrMode: 700,
            },
          }),
          ...createMonthlyBudgetHandlers({
            get: {
              response: count === 0 ? null : { ...monthlyBudgets[2], amount: 25000 },
              durationOrMode: 1500,
            },
          }),
        ],
      },
    },
    globals: { viewport: { value: mobile ? "mobile" : "desktop" } },
    play: async ({ canvasElement }) => {
      expect(window.innerWidth).toBe(mobile ? 320 : 1280)
      const canvas = within(canvasElement)
      const loading = await canvas.findByTestId("home-loading")
      const headingTop = within(loading)
        .getByRole("heading", { name: "Recent payments" })
        .getBoundingClientRect().top
      const listTop = within(loading)
        .getAllByLabelText("loading-payment-item")[0]
        .getBoundingClientRect().top
      expect(canvas.queryByRole("button", { name: "Create payment" })).not.toBeInTheDocument()

      const create = await canvas.findByRole("button", { name: "Create payment" })
      const createTop = create.getBoundingClientRect().top
      expect(canvas.getByLabelText("loading category totals")).toBeInTheDocument()
      expect(canvas.getByTestId("budget-difference-skeleton")).toBeInTheDocument()
      await waitFor(
        () => {
          expect(canvas.queryByLabelText("loading category totals")).not.toBeInTheDocument()
          expect(canvas.queryByTestId("skeleton")).not.toBeInTheDocument()
          expect(canvas.queryByTestId("budget-difference-skeleton")).not.toBeInTheDocument()
          expect(canvas.queryAllByLabelText("loading-payment-item")).toHaveLength(0)
        },
        { timeout: 5000 },
      )

      expect(
        canvas.getByRole("heading", { name: "Recent payments" }).getBoundingClientRect().top,
      ).toBeCloseTo(headingTop, 0)
      expect(create.getBoundingClientRect().top).toBeCloseTo(createTop, 0)
      const recent = canvas.getByLabelText("Recent payments")
      expect(recent.getBoundingClientRect().top).toBeCloseTo(listTop, 0)
      expect(within(recent).queryAllByRole("button")).toHaveLength(count)
      if (count === 0) {
        expect(
          within(recent).getByText("No payments yet. Use “Create payment” to record one."),
        ).toBeVisible()
      }
    },
  }
}

export const LoadingToFivePayments = loadingTransitionStory(5)
export const LoadingToOnePayment = loadingTransitionStory(1)
export const LoadingToEmpty = loadingTransitionStory(0)
export const MobileLoadingToFivePayments = loadingTransitionStory(5, true)
export const MobileLoadingToOnePayment = loadingTransitionStory(1, true)
export const MobileLoadingToEmpty = loadingTransitionStory(0, true)
