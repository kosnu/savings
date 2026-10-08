import type { Meta, StoryObj } from "@storybook/react-vite"
import { createRoute } from "@tanstack/react-router"
import { expect, within } from "storybook/test"

import { paymentsSearchSchema } from "../../../features/payments"
import { SupabaseSessionContext } from "../../../providers/supabase/SupabaseSessionProvider"
import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { createBookHandlers } from "../../../test/msw/handlers/books"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
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
