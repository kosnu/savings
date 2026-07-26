import { createRoute } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { BookSettings } from "../../../features/books"
import { AppearanceSettings } from "../../../features/preferences"
import { ProfileSettings } from "../../../features/profile"
import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { renderWithRouter } from "../../../test/helpers/renderWithRouter"
import { createBookHandlers } from "../../../test/msw/handlers/books"
import { createCategorySettingsHandlers } from "../../../test/msw/handlers/categorySettings"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../test/msw/server"
import { screen, within } from "../../../test/test-utils"
import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../utils/postgresError"
import { SettingsOverview } from "../SettingsOverview"
import { SettingsPage } from "./SettingsPage"

type SettingsBookComponentType = () => ReactNode
type SettingsAppearanceComponentType = () => ReactNode
type SettingsProfileComponentType = () => ReactNode

function renderSettingsPage(
  initialEntry = "/settings",
  options: {
    settingsBookComponent?: SettingsBookComponentType
    settingsAppearanceComponent?: SettingsAppearanceComponentType
    settingsProfileComponent?: SettingsProfileComponentType
  } = {},
) {
  const SettingsBookComponent = options.settingsBookComponent ?? BookSettings
  const SettingsAppearanceComponent = options.settingsAppearanceComponent ?? AppearanceSettings
  const SettingsProfileComponent = options.settingsProfileComponent ?? ProfileSettings

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

    const settingsProfileRoute = createRoute({
      getParentRoute: () => settingsRoute,
      path: "profile",
      component: SettingsProfileComponent,
    })

    const settingsAppearanceRoute = createRoute({
      getParentRoute: () => settingsRoute,
      path: "appearance",
      component: SettingsAppearanceComponent,
    })

    return [
      authenticatedRoute.addChildren([
        settingsRoute.addChildren([
          settingsIndexRoute,
          settingsProfileRoute,
          settingsAppearanceRoute,
          settingsBookRoute,
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

  test("Settings 見出しと設定概要、Profile / Appearance / Book への導線を表示する", async () => {
    const { router, user } = renderSettingsPage("/settings", {
      settingsProfileComponent: () => <div>Profile settings page</div>,
      settingsAppearanceComponent: () => <div>Appearance settings page</div>,
      settingsBookComponent: () => <div>Book settings page</div>,
    })

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(await screen.findByText("Choose a setting to manage.")).toBeInTheDocument()

    const profileOverviewLink = screen
      .getAllByRole("link", { name: /Profile/ })
      .find((link) => link.textContent?.includes("Manage profile information."))
    expect(profileOverviewLink?.getAttribute("href")).toBe("/settings/profile")

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

    const profileLink = await screen.findByRole("link", { name: "Profile" })
    expect(profileLink).toHaveAttribute("href", "/settings/profile")

    const appearanceLink = await screen.findByRole("link", { name: "Appearance" })
    expect(appearanceLink).toHaveAttribute("href", "/settings/appearance")

    const bookLink = await screen.findByRole("link", { name: "Book" })
    expect(bookLink).toHaveAttribute("href", "/settings/book")

    await user.click(profileLink)

    expect(router.state.location.pathname).toBe("/settings/profile")
    expect(await screen.findByText("Profile settings page")).toBeInTheDocument()

    await user.click(appearanceLink)

    expect(router.state.location.pathname).toBe("/settings/appearance")
    expect(await screen.findByText("Appearance settings page")).toBeInTheDocument()

    await user.click(bookLink)

    expect(router.state.location.pathname).toBe("/settings/book")
    expect(await screen.findByText("Book settings page")).toBeInTheDocument()
  })

  test("Profile 設定ではアカウント情報だけを表示する", async () => {
    renderSettingsPage("/settings/profile")

    expect(await screen.findByRole("heading", { name: "Account information" })).toBeInTheDocument()
    expect(await screen.findByRole("textbox", { name: "Display name" })).toHaveValue("Test User")
    expect(await screen.findByText("test@example.com")).toBeInTheDocument()
    expect(await screen.findByText("Google")).toBeInTheDocument()
    expect(screen.queryByText("Language")).not.toBeInTheDocument()
    expect(screen.queryByText("Theme")).not.toBeInTheDocument()
  })

  test("Appearance 設定では現在のLanguageとThemeを表示する", async () => {
    renderSettingsPage("/settings/appearance")

    expect(await screen.findByRole("heading", { name: "Appearance" })).toBeInTheDocument()
    expect(await screen.findByRole("combobox", { name: "Language" })).toHaveTextContent("English")
    expect(await screen.findByRole("combobox", { name: "Theme" })).toHaveTextContent("Light")
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
