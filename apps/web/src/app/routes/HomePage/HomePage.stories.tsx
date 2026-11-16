import { Button, Theme } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { createRoute } from "@tanstack/react-router"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { paymentsSearchSchema } from "../../../features/payments"
import { AppearanceSettings } from "../../../features/preferences"
import { i18next } from "../../../i18n"
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
    const { t } = i18next
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    const total = await canvas.findByLabelText(t("payments.total.label"))
    const summaryRegion = canvas.getByRole("region", { name: t("summary.monthlyOverview") })
    await expect(summaryRegion).toContainElement(total)
    await expect(summaryRegion).not.toHaveTextContent(t("summary.monthlyOverview"))
    const summary = within(summaryRegion)
    const graph = await summary.findByRole("figure", { name: t("summary.spendingChart.title") })
    await expect(total).toBeVisible()
    await expect(graph).toBeVisible()
    const plot = within(graph).getByLabelText(t("summary.spendingChart.graphLabel"))
    const bars = plot.querySelectorAll("rect")
    if (bars.length < 2) throw new globalThis.Error("実績と見込みの棒がありません")
    const actual = getComputedStyle(bars[0])
    const forecast = getComputedStyle(bars[bars.length - 1])
    const allowsMotion = window.matchMedia("(prefers-reduced-motion: no-preference)").matches
    expect(parseFloat(actual.getPropertyValue("rx"))).toBeGreaterThan(0)
    expect(parseFloat(forecast.getPropertyValue("rx"))).toBeGreaterThan(0)
    expect(actual.strokeDasharray).toBe("none")
    expect(forecast.strokeDasharray).not.toBe("none")
    expect(actual.animationDuration).toBe(forecast.animationDuration)
    expect(parseFloat(forecast.animationDuration) > 0).toBe(allowsMotion)
    await expect(await within(total).findByText("¥25,000")).toBeVisible()
    await expect(within(total).getByText(t("common.left", { amount: "¥20,000" }))).toBeVisible()
    await expect(
      await summary.findByText(t("summary.spendingChart.remainingForecast", { amount: "¥20,000" })),
    ).toBeVisible()
    await expect(
      await canvas.findByRole("progressbar", {
        name: t("summary.categoryBudgetProgress", { category: "Food" }),
      }),
    ).toHaveAttribute("aria-valuenow", "1000")
    const recent = await canvas.findByLabelText(t("payments.recent"))
    const category = canvas.getByRole("progressbar", {
      name: t("summary.categoryBudgetProgress", { category: "Food" }),
    })
    expect(total.compareDocumentPosition(graph) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(graph.compareDocumentPosition(category) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(category.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await expect(await within(recent).findAllByRole("button")).toHaveLength(4)
    await expect(canvas.queryByText(/^(Across all dates|全期間)$/)).not.toBeInTheDocument()
    await expect(canvas.getByRole("button", { name: t("payments.create.trigger") })).toBeVisible()
    await expect(
      canvas.queryByRole("combobox", { name: t("payments.category.filter") }),
    ).not.toBeInTheDocument()

    const recentRows = within(recent)
      .getAllByRole("button")
      .map((row) => row.textContent)
    await userEvent.click(summary.getByRole("button", { name: t("date.previousMonth") }))
    await expect(await summary.findByText(t("summary.spendingChart.past"))).toBeVisible()
    const forecastPrefixes = [
      t("summary.spendingChart.remainingForecast", { amount: "¥" }),
      t("summary.spendingChart.overForecast", { amount: "¥" }),
    ].map((label) => label.slice(0, label.indexOf("¥") + 1))
    await expect(
      summary.queryByText((label) => forecastPrefixes.some((prefix) => label.startsWith(prefix))),
    ).not.toBeInTheDocument()
    expect(
      within(recent)
        .getAllByRole("button")
        .map((row) => row.textContent),
    ).toEqual(recentRows)
  },
}
export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createBookHandlers(),
        ...createPaymentHandlers({ initialRows: [] }),
        ...createCategoryHandlers({ get: { paymentRows: [] } }),
        ...createMonthlyBudgetHandlers({ get: { response: null } }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const { t } = i18next
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(t("payments.recent.empty"))).toBeVisible()
    await expect(canvas.getByRole("button", { name: t("payments.create.trigger") })).toBeEnabled()
    await expect(
      await canvas.findByRole("figure", { name: t("summary.spendingChart.title") }),
    ).toBeVisible()
    const total = within(canvas.getByLabelText(t("payments.total.label")))
    await expect(await total.findByText(t("common.notSet"))).toBeVisible()
    await expect(total.getByRole("link", { name: t("budgets.openSettings") })).toHaveAttribute(
      "href",
      "/settings/book",
    )

    await userEvent.click(canvas.getByRole("button", { name: t("date.previousMonth") }))
    await expect(await canvas.findByText(t("summary.spendingChart.past"))).toBeVisible()
    await expect(await total.findByText(t("common.notSet"))).toBeVisible()
    await expect(
      total.queryByRole("link", { name: t("budgets.openSettings") }),
    ).not.toBeInTheDocument()
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
    ).toHaveTextContent(i18next.t("common.failed"))
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
      const { t } = i18next
      expect(window.innerWidth).toBe(mobile ? 320 : 1280)
      const canvas = within(canvasElement)
      await canvas.findByTestId("home-loading")
      expect(
        canvas.queryByRole("button", { name: t("payments.create.trigger") }),
      ).not.toBeInTheDocument()

      const create = await canvas.findByRole("button", { name: t("payments.create.trigger") })
      const createTop = create.getBoundingClientRect().top
      const categoryContent = canvas.getByLabelText(
        t("summary.loadingCategoryTotals"),
      ).parentElement
      if (!categoryContent) throw new globalThis.Error("カテゴリ集計の表示領域がありません")
      expect(canvas.getByTestId("budget-difference-skeleton")).toBeInTheDocument()
      await waitFor(
        () => {
          expect(
            canvas.queryByLabelText(t("summary.loadingCategoryTotals")),
          ).not.toBeInTheDocument()
          expect(canvas.queryByTestId("skeleton")).not.toBeInTheDocument()
          expect(canvas.queryByTestId("budget-difference-skeleton")).not.toBeInTheDocument()
          expect(canvas.queryAllByLabelText("loading-payment-item")).toHaveLength(0)
        },
        { timeout: 5000 },
      )

      expect(create.getBoundingClientRect().top).toBeCloseTo(createTop, 0)
      const categoryItems = categoryContent.firstElementChild
      const graph = await canvas.findByRole("figure", { name: t("summary.spendingChart.title") })
      const chart = graph.parentElement
      if (!categoryItems || !chart?.parentElement) {
        throw new globalThis.Error("集計の表示内容がありません")
      }
      expect(categoryContent.getBoundingClientRect().height).toBeCloseTo(
        categoryItems.getBoundingClientRect().height,
        0,
      )
      expect(chart.parentElement.getBoundingClientRect().height).toBeCloseTo(
        chart.getBoundingClientRect().height,
        0,
      )
      if (mobile) {
        const bounds = create.getBoundingClientRect()
        expect(bounds.top).toBeGreaterThanOrEqual(0)
        expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight)
        expect(bounds.left).toBeGreaterThanOrEqual(0)
        expect(bounds.right).toBeLessThanOrEqual(window.innerWidth)
      }
      const recent = canvas.getByLabelText(t("payments.recent"))
      expect(within(recent).queryAllByRole("button")).toHaveLength(count)
      if (count === 0) {
        expect(within(recent).getByText(t("payments.recent.empty"))).toBeVisible()
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
        <Theme appearance={mobile ? "dark" : "light"}>
          <Button
            variant="soft"
            onClick={() => openSnackbar("info", "Notification for positioning", 30000)}
          >
            Show notification
          </Button>
          <HomePage />
        </Theme>
      )
    },
    play: async ({ canvasElement }) => {
      const { t } = i18next
      const canvas = within(canvasElement)
      const body = within(canvasElement.ownerDocument.body)
      const create = await canvas.findByRole("button", { name: t("payments.create.trigger") })
      await expect(create).toHaveClass("rt-variant-soft")
      await expect(create).not.toHaveClass("rt-high-contrast")
      const header = canvas.getByRole("banner")
      const navigateFromSidebar = async (linkName: string) => {
        if (mobile) await userEvent.click(canvas.getByRole("button", { name: t("header.menu") }))
        const navigation = canvas.getByRole("navigation", { name: t("navigation.main") })
        await userEvent.click(within(navigation).getByRole("link", { name: linkName }))
        if (mobile) {
          expect(canvas.queryByRole("navigation", { name: t("navigation.main") })).toBeNull()
        }
      }

      if (mobile) {
        expect(canvas.queryByRole("navigation", { name: t("navigation.main") })).toBeNull()
        expect(within(header).getByRole("button", { name: t("header.menu") })).toBeVisible()
      } else {
        expect(within(header).queryByRole("button", { name: t("header.menu") })).toBeNull()
        const sidebar = canvas.getByRole("complementary")
        const navigation = within(sidebar).getByRole("navigation", { name: t("navigation.main") })
        const brandHeader = within(sidebar).getByRole("link", { name: t("app.name") }).parentElement
        if (!brandHeader) throw new globalThis.Error("サイドバーのヘッダーがありません")
        const main = canvas.getByRole("main")
        const openBounds = main.getBoundingClientRect()
        const sidebarBounds = sidebar.getBoundingClientRect()
        expect(sidebarBounds.right).toBeLessThanOrEqual(openBounds.left)
        expect(brandHeader.getBoundingClientRect().height).toBeCloseTo(
          header.getBoundingClientRect().height,
          0,
        )
        expect(getComputedStyle(header).borderBottomWidth).toBe("1px")
        expect(sidebar.querySelectorAll(".rt-Separator")).toHaveLength(1)
        expect(navigation.querySelectorAll(".rt-Separator")).toHaveLength(1)
        const homeLink = within(navigation).getByRole("link", { name: t("navigation.homeAria") })
        expect(homeLink).toHaveAttribute("aria-current", "page")

        await userEvent.click(
          within(header).getByRole("button", { name: t("header.closeSidebar") }),
        )
        expect(navigation).toBeVisible()
        await waitFor(() => {
          const closedBounds = main.getBoundingClientRect()
          const collapsedBounds = sidebar.getBoundingClientRect()
          expect(closedBounds.width).toBeGreaterThan(openBounds.width)
          expect(collapsedBounds.width).toBeGreaterThan(0)
          expect(homeLink.getBoundingClientRect().right).toBeLessThanOrEqual(collapsedBounds.right)
          expect(collapsedBounds.right).toBeCloseTo(closedBounds.left, 0)
          expect(closedBounds.top).toBeCloseTo(openBounds.top, 0)
        })
        expect(within(header).getByRole("button", { name: t("header.openSidebar") })).toHaveFocus()
        await userEvent.keyboard("{Enter}")
        expect(canvas.getByRole("complementary")).toBeVisible()
        await waitFor(() => {
          expect(main.getBoundingClientRect().width).toBeCloseTo(openBounds.width, 0)
        })
      }
      expect(
        within(header).queryByRole("button", { name: /^(Theme toggle|テーマ切り替え)$/ }),
      ).not.toBeInTheDocument()
      const recent = await canvas.findByLabelText(t("payments.recent"))
      await within(recent).findAllByRole("button")
      const total = within(await canvas.findByLabelText(t("payments.total.label")))
      const spent = await total.findByText("¥5,000")
      const budget = await total.findByText("¥25,000")
      const heading = total.getByText(t("summary.monthlyBudgetHeading"))
      const remaining = total.getByText(t("common.left", { amount: "¥20,000" }))
      const progress = total.getByRole("progressbar", { name: t("summary.monthlyBudgetProgress") })
      const spentBounds = spent.getBoundingClientRect()
      const budgetBounds = budget.getBoundingClientRect()
      const progressBounds = progress.getBoundingClientRect()
      const headingBounds = heading.getBoundingClientRect()
      const remainingBounds = remaining.getBoundingClientRect()
      expect(spentBounds.top).toBeCloseTo(budgetBounds.top, 0)
      expect(spentBounds.bottom).toBeLessThanOrEqual(progressBounds.top)
      expect(headingBounds.left).toBeCloseTo(progressBounds.left, 0)
      expect(budgetBounds.right).toBeCloseTo(progressBounds.right, 0)
      expect(remainingBounds.right).toBeCloseTo(progressBounds.right, 0)
      expect(remainingBounds.top).toBeGreaterThanOrEqual(progressBounds.bottom)
      expect(getComputedStyle(remaining).textAlign).toBe("right")
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
          if (!mobile) {
            expect(canvas.getByRole("complementary").getBoundingClientRect().top).toBeCloseTo(0, 0)
          }
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
        const dialog = await body.findByRole("dialog", { name: t("payments.create.title") })
        const bounds = create.getBoundingClientRect()
        expect(
          create.contains(
            document.elementFromPoint(
              bounds.left + bounds.width / 2,
              bounds.top + bounds.height / 2,
            ),
          ),
        ).toBe(false)
        await within(dialog).findByLabelText(t("amount.label"), { exact: false })
        await userEvent.keyboard("{Escape}")
        await waitFor(async () => expect(body.queryByRole("dialog")).not.toBeInTheDocument())
        await expect(create).toHaveFocus()

        await userEvent.click(create)
        const reopened = await body.findByRole("dialog", { name: t("payments.create.title") })
        await userEvent.type(
          within(reopened).getByLabelText(t("amount.label"), { exact: false }),
          "1080",
        )
        await userEvent.type(
          within(reopened).getByLabelText(t("payments.note.label"), { exact: false }),
          "Header payment",
        )
        await userEvent.click(within(reopened).getByRole("button", { name: t("common.create") }))
        await waitFor(async () => expect(body.queryByRole("dialog")).not.toBeInTheDocument())
        await expect(await within(recent).findByText("Header payment")).toBeVisible()

        await navigateFromSidebar(t("navigation.paymentsAria"))
        await canvas.findByRole("heading", { name: t("navigation.payments"), level: 1 })
        if (mobile) {
          const paymentsHeader = canvas.getByRole("banner")
          expect(within(paymentsHeader).getAllByRole("button")).toHaveLength(1)
          expect(
            within(paymentsHeader).getByRole("button", { name: t("header.menu") }),
          ).toBeVisible()
        } else {
          expect(
            within(canvas.getByRole("banner")).getByRole("button", {
              name: t("header.closeSidebar"),
            }),
          ).toBeVisible()
          expect(canvas.getByRole("link", { name: t("navigation.paymentsAria") })).toHaveAttribute(
            "aria-current",
            "page",
          )
        }

        await navigateFromSidebar(t("navigation.settingsAria"))
        await canvas.findByRole("heading", { name: t("settings.title"), level: 1 })
        await userEvent.click(
          within(canvas.getByRole("navigation", { name: t("settings.sections") })).getByRole(
            "link",
            {
              name: t("navigation.appearance"),
            },
          ),
        )
        expect(await canvas.findByRole("combobox", { name: t("theme.label") })).toBeVisible()

        if (mobile) {
          await userEvent.click(
            canvas.getByRole("link", { name: t("header.logo", { appName: t("app.name") }) }),
          )
        } else {
          expect(canvas.getByRole("link", { name: t("navigation.settingsAria") })).toHaveAttribute(
            "aria-current",
            "page",
          )
          await navigateFromSidebar(t("navigation.homeAria"))
        }
        expect(
          await canvas.findByRole("button", {
            name: t("payments.create.trigger"),
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
