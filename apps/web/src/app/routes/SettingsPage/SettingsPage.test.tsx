import { createRoute } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { BookSettings } from "../../../features/books"
import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { renderWithRouter } from "../../../test/helpers/renderWithRouter"
import { createCategorySettingsHandlers } from "../../../test/msw/handlers/categorySettings"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../test/msw/server"
import { screen, within } from "../../../test/test-utils"
import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../utils/postgresError"
import { SettingsPage } from "./SettingsPage"

type SettingsBookComponentType = () => ReactNode

function renderSettingsPage(
  initialEntry = "/settings",
  options: { settingsBookComponent?: SettingsBookComponentType } = {},
) {
  const SettingsBookComponent = options.settingsBookComponent ?? BookSettings

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

    const settingsBookRoute = createRoute({
      getParentRoute: () => settingsRoute,
      path: "book",
      component: SettingsBookComponent,
    })

    return [authenticatedRoute.addChildren([settingsRoute.addChildren([settingsBookRoute])])]
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

  test("Settings 見出しと Book への導線を表示する", async () => {
    const { router, user } = renderSettingsPage("/settings", {
      settingsBookComponent: () => <div>Book settings page</div>,
    })

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument()

    const settingsLink = await screen.findByRole("link", { name: "Settings" })
    expect(settingsLink).toHaveAttribute("href", "/settings")

    const bookLink = await screen.findByRole("link", { name: "Book" })
    expect(bookLink).toHaveAttribute("href", "/settings/book")

    await user.click(bookLink)

    expect(router.state.location.pathname).toBe("/settings/book")
    expect(await screen.findByText("Book settings page")).toBeInTheDocument()
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
