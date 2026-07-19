import { createRoute } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { BookSettings } from "../../../features/books"
import { ProfileSettings } from "../../../features/profile"
import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { renderWithRouter } from "../../../test/helpers/renderWithRouter"
import { createCategorySettingsHandlers } from "../../../test/msw/handlers/categorySettings"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../test/msw/server"
import { screen, within } from "../../../test/test-utils"
import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../utils/postgresError"
import { SettingsOverview } from "../SettingsOverview"
import { SettingsPage } from "./SettingsPage"

type SettingsBookComponentType = () => ReactNode
type SettingsProfileComponentType = () => ReactNode

function renderSettingsPage(
  initialEntry = "/settings",
  options: {
    settingsBookComponent?: SettingsBookComponentType
    settingsProfileComponent?: SettingsProfileComponentType
  } = {},
) {
  const SettingsBookComponent = options.settingsBookComponent ?? BookSettings
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

    return [
      authenticatedRoute.addChildren([
        settingsRoute.addChildren([settingsIndexRoute, settingsProfileRoute, settingsBookRoute]),
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

  test("Settings 見出しと設定概要、Profile / Book への導線を表示する", async () => {
    const { router, user } = renderSettingsPage("/settings", {
      settingsProfileComponent: () => <div>Profile settings page</div>,
      settingsBookComponent: () => <div>Book settings page</div>,
    })

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(await screen.findByText("Choose a setting to manage.")).toBeInTheDocument()

    const profileOverviewLink = screen
      .getAllByRole("link", { name: /Profile/ })
      .find((link) => link.textContent?.includes("Manage profile information and language."))
    expect(profileOverviewLink?.getAttribute("href")).toBe("/settings/profile")

    const bookOverviewLink = screen
      .getAllByRole("link", { name: /Book/ })
      .find((link) => link.textContent?.includes("Manage monthly budgets and categories."))
    expect(bookOverviewLink?.getAttribute("href")).toBe("/settings/book")

    const settingsLink = await screen.findByRole("link", { name: "Settings" })
    expect(settingsLink).toHaveAttribute("href", "/settings")

    const profileLink = await screen.findByRole("link", { name: "Profile" })
    expect(profileLink).toHaveAttribute("href", "/settings/profile")

    const bookLink = await screen.findByRole("link", { name: "Book" })
    expect(bookLink).toHaveAttribute("href", "/settings/book")

    await user.click(profileLink)

    expect(router.state.location.pathname).toBe("/settings/profile")
    expect(await screen.findByText("Profile settings page")).toBeInTheDocument()

    await user.click(bookLink)

    expect(router.state.location.pathname).toBe("/settings/book")
    expect(await screen.findByText("Book settings page")).toBeInTheDocument()
  })

  test("Profile 設定ではアカウント情報とLanguage設定を表示する", async () => {
    renderSettingsPage("/settings/profile")

    expect(await screen.findByRole("heading", { name: "Account information" })).toBeInTheDocument()
    expect(await screen.findByRole("textbox", { name: "Display name" })).toHaveValue("Test User")
    expect(await screen.findByText("test@example.com")).toBeInTheDocument()
    expect(await screen.findByText("Google")).toBeInTheDocument()
    expect(await screen.findByText("Language")).toBeInTheDocument()
    expect(await screen.findByRole("combobox", { name: "Language" })).toBeInTheDocument()
    expect(screen.queryByText("Theme")).not.toBeInTheDocument()
  })

  test("Book 設定では既存の最新月予算表示を維持する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudgets[3] },
      }),
      ...createCategorySettingsHandlers(),
    )

    renderSettingsPage("/settings/book")

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
