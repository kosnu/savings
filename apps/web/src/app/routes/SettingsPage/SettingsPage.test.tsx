import {
  createMemoryHistory,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import type { ReactNode } from "react"
import { afterEach, describe, expect, onTestFinished, test, vi } from "vite-plus/test"

import { BookSettings } from "../../../features/books"
import { DataManagementSettings } from "../../../features/payments"
import { AppearanceSettings } from "../../../features/preferences"
import { AccountSettings } from "../../../features/profile"
import { i18next } from "../../../i18n"
import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { mockSession } from "../../../test/data/supabaseSession"
import { renderWithRouter } from "../../../test/helpers/renderWithRouter"
import { createBookHandlers } from "../../../test/msw/handlers/books"
import { createCategorySettingsHandlers } from "../../../test/msw/handlers/categorySettings"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createProfileHandlers } from "../../../test/msw/handlers/profile"
import { server } from "../../../test/msw/server"
import { render, screen, within } from "../../../test/test-utils"
import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../utils/postgresError"
import { router as appRouter } from "../../routes"
import { SettingsOverview } from "../SettingsOverview"
import { SettingsPage } from "./SettingsPage"

type SettingsBookComponentType = () => ReactNode
type SettingsAppearanceComponentType = () => ReactNode

function renderSettingsPage(
  initialEntry = "/settings",
  options: {
    settingsBookComponent?: SettingsBookComponentType
    settingsAppearanceComponent?: SettingsAppearanceComponentType
  } = {},
) {
  const SettingsBookComponent = options.settingsBookComponent ?? BookSettings
  const SettingsAppearanceComponent = options.settingsAppearanceComponent ?? AppearanceSettings

  return renderWithRouter(initialEntry, (root) => {
    const authenticatedRoute = createRoute({
      getParentRoute: () => root,
      id: "authenticated",
    })

    const settingsRoute = createRoute({
      getParentRoute: () => authenticatedRoute,
      path: "/settings",
      component: SettingsPage,
    })

    const settingsIndexRoute = createRoute({
      getParentRoute: () => settingsRoute,
      path: "/",
      component: SettingsOverview,
    })

    const settingsBookRoute = createRoute({
      getParentRoute: () => settingsRoute,
      path: "book",
      component: SettingsBookComponent,
    })

    const settingsAppearanceRoute = createRoute({
      getParentRoute: () => settingsRoute,
      path: "appearance",
      component: SettingsAppearanceComponent,
    })

    const settingsAccountRoute = createRoute({
      getParentRoute: () => settingsRoute,
      path: "account",
      component: AccountSettings,
    })

    const settingsDataManagementRoute = createRoute({
      getParentRoute: () => settingsRoute,
      path: "data-management",
      component: DataManagementSettings,
    })

    return [
      authenticatedRoute.addChildren([
        settingsRoute.addChildren([
          settingsIndexRoute,
          settingsAccountRoute,
          settingsAppearanceRoute,
          settingsBookRoute,
          settingsDataManagementRoute,
        ]),
      ]),
    ]
  })
}

async function fillCreateMonthlyBudgetForm(
  user: ReturnType<typeof renderSettingsPage>["user"],
  dialog: HTMLElement,
  body: ReturnType<typeof within>,
) {
  await user.click(within(dialog).getByRole("combobox", { name: "Year" }))
  await user.click(await body.findByRole("option", { name: "2026" }))
  await user.click(within(dialog).getByRole("combobox", { name: "Month" }))
  await user.click(await body.findByRole("option", { name: "October" }))
  await user.type(within(dialog).getByRole("textbox", { name: /amount/i }), "300000")
}

describe("SettingsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("設定概要とメニューからAccount / Appearance / Bookへ遷移する", async () => {
    const { router, user } = renderSettingsPage("/settings", {
      settingsAppearanceComponent: () => <div>Appearance settings page</div>,
      settingsBookComponent: () => <div>Book settings page</div>,
    })

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(await screen.findByText("Choose a setting to manage.")).toBeInTheDocument()

    expect(screen.queryByRole("link", { name: /Profile/ })).not.toBeInTheDocument()

    const accountOverviewLink = screen.getByRole("link", {
      name: /Account.*Edit your display name, view your registered email address, or delete your account/,
    })
    expect(accountOverviewLink).toHaveAttribute("href", "/settings/account")

    const appearanceOverviewLink = screen
      .getAllByRole("link", { name: /Appearance/ })
      .find((link) => link.textContent?.includes("Manage language and theme."))
    expect(appearanceOverviewLink?.getAttribute("href")).toBe("/settings/appearance")

    const bookOverviewLink = screen
      .getAllByRole("link", { name: /Book/ })
      .find((link) =>
        link.textContent?.includes(
          "View the current book and manage its monthly budget and categories.",
        ),
      )
    expect(bookOverviewLink?.getAttribute("href")).toBe("/settings/book")

    const settingsLink = await screen.findByRole("link", { name: "Settings" })
    expect(settingsLink).toHaveAttribute("href", "/settings")

    const accountLink = screen.getByRole("link", { name: "Account" })
    expect(accountLink).toHaveAttribute("href", "/settings/account")

    const appearanceLink = await screen.findByRole("link", { name: "Appearance" })
    expect(appearanceLink).toHaveAttribute("href", "/settings/appearance")

    const bookLink = await screen.findByRole("link", { name: "Book" })
    expect(bookLink).toHaveAttribute("href", "/settings/book")

    await user.click(accountLink)

    expect(router.state.location.pathname).toBe("/settings/account")
    expect(await screen.findByRole("heading", { name: "Account", level: 2 })).toBeInTheDocument()
    expect(await screen.findByText("test@example.com")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Delete account", level: 3 })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Display name" })).toHaveValue("Test User")

    await user.click(appearanceLink)

    expect(router.state.location.pathname).toBe("/settings/appearance")
    expect(await screen.findByText("Appearance settings page")).toBeInTheDocument()

    await user.click(bookLink)

    expect(router.state.location.pathname).toBe("/settings/book")
    expect(await screen.findByText("Book settings page")).toBeInTheDocument()
  })

  test("設定概要からデータ管理へ遷移し、その中のエクスポートを操作できる", async () => {
    const { user, router } = renderSettingsPage()
    const link = await screen.findByRole("link", {
      name: /Data management.*Export payment data as CSV/,
    })
    await user.click(link)
    expect(router.state.location.pathname).toBe("/settings/data-management")
    expect(await screen.findByRole("heading", { name: "Data management" })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Payment data export", level: 3 }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Start date/)).toBeInTheDocument()
    expect(screen.getByLabelText(/End date/)).toBeInTheDocument()
  })

  test("旧プロフィールURLをアカウント設定に置換し、戻る履歴を増やさない", async () => {
    const previousLanguage = i18next.language
    await i18next.changeLanguage("ja")
    onTestFinished(async () => {
      await i18next.changeLanguage(previousLanguage)
    })
    const router = createRouter({
      routeTree: appRouter.options.routeTree,
      history: createMemoryHistory({ initialEntries: ["/settings/profile"] }),
      context: { authStatus: "authenticated", supabaseSession: mockSession() },
    })
    render(<RouterProvider router={router} />)

    expect(await screen.findByRole("heading", { name: "アカウント", level: 2 })).toBeVisible()
    expect(router.state.location.pathname).toBe("/settings/account")
    expect(router.history.canGoBack()).toBe(false)
    expect(await screen.findByRole("textbox", { name: "表示名" })).toHaveValue("Test User")
    expect(screen.getByText("test@example.com")).toBeVisible()
    expect(screen.getByText("読み取り専用")).toBeVisible()
    expect(screen.getByRole("button", { name: "アカウントの削除を予約" })).toBeEnabled()
    expect(screen.queryByText("ログイン方法")).not.toBeInTheDocument()
  })

  test("アカウント情報の読み込みに失敗しても削除操作が残り、再試行で表示名とメールを確認できる", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.use(...createProfileHandlers({ get: { error: true } }))
    const { user } = renderSettingsPage("/settings/account")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load your display name or email address.",
    )
    expect(screen.getByRole("button", { name: "Schedule account deletion" })).toBeEnabled()
    server.use(
      ...createProfileHandlers({
        get: { response: { name: "Test User", email: "registered@example.com" } },
      }),
    )
    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByText("registered@example.com")).toBeVisible()
    expect(screen.getByRole("textbox", { name: "Display name" })).toHaveValue("Test User")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("Appearance 設定では現在のLanguageとThemeを表示する", async () => {
    renderSettingsPage("/settings/appearance")

    expect(await screen.findByRole("heading", { name: "Appearance" })).toBeInTheDocument()
    expect(await screen.findByRole("combobox", { name: "Language" })).toHaveTextContent("English")
    expect(await screen.findByRole("combobox", { name: "Theme" })).toHaveTextContent("System")
  })

  test("Book 設定では既存の最新月予算表示を維持する", async () => {
    server.resetHandlers(
      ...createBookHandlers(),
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudgets[3] },
      }),
      ...createCategorySettingsHandlers(),
    )

    renderSettingsPage("/settings/book")

    expect(await screen.findByRole("heading", { name: "Default Book" })).toBeInTheDocument()
    expect(await screen.findByText("Current book")).toBeInTheDocument()
    expect(
      await screen.findByText("The monthly budget and categories below belong to this book."),
    ).toBeInTheDocument()
    expect(await screen.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await screen.findByText("¥75,000")).toBeInTheDocument()
    expect(screen.queryByText("¥62,000")).not.toBeInTheDocument()
    expect(await screen.findByText("Categories")).toBeInTheDocument()
    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(await screen.findByText("Name")).toBeInTheDocument()
    expect(await screen.findAllByText("Pin")).not.toHaveLength(0)
    expect(await screen.findAllByText("Not set")).not.toHaveLength(0)
    expect(screen.queryByText("Not pinned")).not.toBeInTheDocument()
    expect(screen.queryByText("Category Budgets")).not.toBeInTheDocument()
  })

  test("現在のBook情報を取得できない場合も月予算とカテゴリを表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createBookHandlers({ error: true }),
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudgets[3] },
      }),
      ...createCategorySettingsHandlers(),
    )

    renderSettingsPage("/settings/book")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load current book information.",
    )
    expect(await screen.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await screen.findByText("¥75,000")).toBeInTheDocument()
    expect(await screen.findByText("Categories")).toBeInTheDocument()
    expect(await screen.findByText("Food")).toBeInTheDocument()
  })

  test("月予算が未登録の場合は予算登録ボタンを表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: null },
      }),
      ...createCategorySettingsHandlers(),
    )

    renderSettingsPage("/settings/book")

    expect(await screen.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Create budget" })).toBeInTheDocument()
  })

  test("作成失敗時は既存のエラー表示を維持する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: null },
        create: {
          error: true,
          errorResponse: {
            code: POSTGRES_UNIQUE_VIOLATION_CODE,
            message: "duplicate key value violates unique constraint",
          },
        },
      }),
      ...createCategorySettingsHandlers(),
    )

    const { user, baseElement } = renderSettingsPage("/settings/book")

    await user.click(await screen.findByRole("button", { name: "Create budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Create monthly budget" })
    const body = within(baseElement)

    await fillCreateMonthlyBudgetForm(user, dialog, body)
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    expect(
      await within(dialog).findByText("A monthly budget for this month already exists."),
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Create monthly budget" })).toBeInTheDocument()
  })
})
