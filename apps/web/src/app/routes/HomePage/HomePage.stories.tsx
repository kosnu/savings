import { Button } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { createRoute } from "@tanstack/react-router"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { paymentsSearchSchema } from "../../../features/payments"
import { AppearanceSettings } from "../../../features/preferences"
import { useSnackbar } from "../../../providers/snackbar/SnackbarProvider"
import { SupabaseSessionContext } from "../../../providers/supabase/SupabaseSessionProvider"
import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { payments as samplePayments } from "../../../test/data/payments"
import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { createBookHandlers } from "../../../test/msw/handlers/books"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import { AppLayout } from "../../AppLayout"
import { PaymentsPage } from "../PaymentsPage"
import { SettingsOverview } from "../SettingsOverview"
import { SettingsPage } from "../SettingsPage"
import { HomePage } from "./HomePage"

const meta = {
  title: "Pages/HomePage",
  component: HomePage,
  tags: ["browser-test"],
  decorators: [
    createStoryRouter("/?year=2025&month=6", (root, Story) => {
      const home = createRoute({
        getParentRoute: () => root,
        path: "/",
        component: Story,
        validateSearch: paymentsSearchSchema.pick({ year: true, month: true }),
      })
      const authenticated = createRoute({
        getParentRoute: () => root,
        id: "authenticated",
        component: AppLayout,
      })
      const payments = createRoute({
        getParentRoute: () => authenticated,
        path: "/payments",
        component: PaymentsPage,
        validateSearch: paymentsSearchSchema,
      })
      const details = createRoute({ getParentRoute: () => payments, path: "details/$paymentId" })
      const settings = createRoute({
        getParentRoute: () => authenticated,
        path: "/settings",
        component: SettingsPage,
      })
      const overview = createRoute({
        getParentRoute: () => settings,
        path: "/",
        component: SettingsOverview,
      })
      const appearance = createRoute({
        getParentRoute: () => settings,
        path: "appearance",
        component: AppearanceSettings,
      })
      return [
        home,
        authenticated.addChildren([
          payments.addChildren([details]),
          settings.addChildren([overview, appearance]),
        ]),
      ]
    }),
  ],
  parameters: {
    layout: "fullscreen",
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
    const total = await canvas.findByLabelText("Total spending")
    const graph = await canvas.findByRole("figure", { name: "Spending through the month" })
    await expect(total).toBeVisible()
    await expect(graph).toBeVisible()
    await expect(
      await canvas.findByRole("progressbar", { name: "Food budget progress" }),
    ).toHaveAttribute("aria-valuenow", "1000")
    const recent = await canvas.findByLabelText("Recent payments")
    const category = canvas.getByRole("progressbar", { name: "Food budget progress" })
    expect(graph.compareDocumentPosition(total) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(total.compareDocumentPosition(category) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(category.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
    await expect(
      await canvas.findByRole("figure", { name: "Spending through the month" }),
    ).toBeVisible()
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
      if (mobile) {
        const bounds = create.getBoundingClientRect()
        expect(bounds.top).toBeGreaterThanOrEqual(0)
        expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight)
        expect(bounds.left).toBeGreaterThanOrEqual(0)
        expect(bounds.right).toBeLessThanOrEqual(window.innerWidth)
      }
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

function headerActionStory(mobile: boolean): Story {
  return {
    parameters: {
      msw: {
        handlers: [
          ...createBookHandlers(),
          ...createPaymentHandlers({ persistCreatedRows: true }),
          ...createCategoryHandlers(),
          ...createMonthlyBudgetHandlers({
            get: { response: { ...monthlyBudgets[2], amount: 25000 } },
          }),
        ],
      },
      viewport: {
        options: {
          desktop: { name: "Desktop", styles: { width: "1280px", height: "900px" } },
          mobile: { name: "Mobile", styles: { width: "320px", height: "568px" } },
        },
      },
    },
    globals: { viewport: { value: mobile ? "mobile" : "desktop" } },
    render: () => {
      const { openSnackbar } = useSnackbar()
      return (
        <>
          <Button
            variant="soft"
            onClick={() => openSnackbar("info", "Notification for positioning", 30000)}
          >
            Show notification
          </Button>
          <HomePage />
        </>
      )
    },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement)
      const body = within(canvasElement.ownerDocument.body)
      const create = await canvas.findByRole("button", { name: "Create payment" })
      const header = canvas.getByRole("banner")
      expect(within(header).queryByRole("button", { name: "Theme toggle" })).not.toBeInTheDocument()
      const recent = await canvas.findByLabelText("Recent payments")
      await within(recent).findAllByRole("button")
      const initial = create.getBoundingClientRect()
      const initialHeaderTop = header.getBoundingClientRect().top
      expect(initial.bottom).toBeLessThanOrEqual(window.innerHeight)
      expect(initial.right).toBeLessThanOrEqual(window.innerWidth)
      expect(initial.left).toBeGreaterThanOrEqual(0)
      expect(initial.top).toBeGreaterThanOrEqual(0)
      expect(initial.top).toBeLessThan(header.getBoundingClientRect().bottom)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)

      try {
        await userEvent.click(canvas.getByRole("button", { name: "Show notification" }))
        window.scrollTo(0, document.documentElement.scrollHeight)
        await waitFor(() => {
          expect(window.scrollY).toBeGreaterThan(0)
          expect(header.getBoundingClientRect().top).toBeCloseTo(0, 0)
          expect(create.getBoundingClientRect().top).toBeCloseTo(initial.top - initialHeaderTop, 0)
          const paymentButtons = within(recent).getAllByRole("button")
          const lastPayment = paymentButtons[paymentButtons.length - 1]
          expect(lastPayment.getBoundingClientRect().top).toBeGreaterThan(
            header.getBoundingClientRect().bottom,
          )
        })
        const notification = await body.findByText("Notification for positioning")
        const toast = notification.closest("li")
        if (!toast) throw new globalThis.Error("通知の表示領域がありません")
        await waitFor(() => {
          expect(toast.getBoundingClientRect().top).toBeGreaterThan(
            create.getBoundingClientRect().bottom,
          )
        })
        await userEvent.click(within(toast).getByRole("button"))

        await userEvent.click(create)
        const dialog = await body.findByRole("dialog", { name: "Create payment" })
        const bounds = create.getBoundingClientRect()
        expect(
          create.contains(
            document.elementFromPoint(
              bounds.left + bounds.width / 2,
              bounds.top + bounds.height / 2,
            ),
          ),
        ).toBe(false)
        await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
        await waitFor(async () => expect(body.queryByRole("dialog")).not.toBeInTheDocument())
        await expect(create).toHaveFocus()

        await userEvent.click(create)
        const reopened = await body.findByRole("dialog", { name: "Create payment" })
        await userEvent.type(within(reopened).getByLabelText("Amount", { exact: false }), "1080")
        await userEvent.type(
          within(reopened).getByLabelText("Note", { exact: false }),
          "Header payment",
        )
        await userEvent.click(within(reopened).getByRole("button", { name: /^Create$/ }))
        await waitFor(async () => expect(body.queryByRole("dialog")).not.toBeInTheDocument())
        await expect(await within(recent).findByText("Header payment")).toBeVisible()

        await userEvent.click(within(header).getByRole("button", { name: "Menu button" }))
        await userEvent.click(canvas.getByRole("link", { name: "Navigate to Payments page" }))
        await canvas.findByRole("heading", { name: "Payments", level: 1 })
        let otherHeader = await canvas.findByRole("banner")
        expect(within(otherHeader).getAllByRole("button")).toHaveLength(1)
        expect(
          within(otherHeader).queryByRole("button", { name: "Create payment" }),
        ).not.toBeInTheDocument()
        expect(
          within(otherHeader).queryByRole("button", { name: "Theme toggle" }),
        ).not.toBeInTheDocument()

        await userEvent.click(within(otherHeader).getByRole("button", { name: "Menu button" }))
        await userEvent.click(canvas.getByRole("link", { name: "Navigate to Settings page" }))
        await canvas.findByRole("heading", { name: "Settings", level: 1 })
        otherHeader = await canvas.findByRole("banner")
        expect(within(otherHeader).getAllByRole("button")).toHaveLength(1)
        await userEvent.click(
          within(canvas.getByRole("navigation", { name: "Settings sections" })).getByRole("link", {
            name: "Appearance",
          }),
        )
        expect(await canvas.findByRole("combobox", { name: "Theme" })).toBeVisible()

        await userEvent.click(within(otherHeader).getByRole("link", { name: "Burneto — Home" }))
        expect(
          await canvas.findByRole("button", {
            name: "Create payment",
          }),
        ).toBeEnabled()
      } finally {
        window.scrollTo(0, 0)
      }
    },
  }
}

export const DesktopHeaderCreatePayment = headerActionStory(false)
export const MobileHeaderCreatePayment = headerActionStory(true)
