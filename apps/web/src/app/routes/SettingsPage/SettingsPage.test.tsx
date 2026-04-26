import { createRoute, redirect } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../features/budgets/createMonthlyBudget/monthlyBudgetCreateError"
import { LatestMonthlyBudget } from "../../../features/budgets/latestMonthlyBudget"
import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { renderWithRouter } from "../../../test/helpers/renderWithRouter"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../test/msw/server"
import { screen, waitFor, within } from "../../../test/test-utils"
import { SettingsPage } from "./SettingsPage"

function BudgetSettingsRouteProbe() {
  return <div>Budget settings route</div>
}

type SettingsBudgetsComponentType = () => ReactNode

function renderSettingsPage(
  initialEntry = "/settings",
  options: { settingsBudgetsComponent?: SettingsBudgetsComponentType } = {},
) {
  const SettingsBudgetsComponent = options.settingsBudgetsComponent ?? LatestMonthlyBudget

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

    const settingsBudgetsRoute = createRoute({
      getParentRoute: () => settingsRoute,
      path: "budgets",
      component: SettingsBudgetsComponent,
    })

    const legacyBudgetsRoute = createRoute({
      getParentRoute: () => authenticatedRoute,
      path: "/budgets",
      beforeLoad: () => {
        throw redirect({ to: "/settings/budgets" })
      },
    })

    return [
      authenticatedRoute.addChildren([
        settingsRoute.addChildren([settingsBudgetsRoute]),
        legacyBudgetsRoute,
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
  await user.click(await body.findByRole("option", { name: "3" }))
  await user.type(within(dialog).getByRole("textbox", { name: /amount/i }), "300000")
}

describe("SettingsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("Settings 見出しと Budgets への導線を表示する", async () => {
    renderSettingsPage()

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument()

    const settingsLink = await screen.findByRole("link", { name: "Settings" })
    expect(settingsLink).toHaveAttribute("href", "/settings")

    const budgetsLink = await screen.findByRole("link", { name: "Budgets" })
    expect(budgetsLink).toHaveAttribute("href", "/settings/budgets")
  })

  test("/budgets から予算設定へ到達できる", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [] },
      }),
    )
    const { router } = renderSettingsPage("/budgets", {
      settingsBudgetsComponent: BudgetSettingsRouteProbe,
    })

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/settings/budgets")
    })
    expect(await screen.findByText("Budget settings route")).toBeInTheDocument()
  })

  test("予算設定では最新の月予算だけを表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [monthlyBudgets[3], monthlyBudgets[2]] },
      }),
    )

    renderSettingsPage("/settings/budgets")

    expect(await screen.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await screen.findByText("￥75,000")).toBeInTheDocument()
    expect(screen.queryByText("￥62,000")).not.toBeInTheDocument()
  })

  test("月予算が未登録の場合は予算登録ボタンを表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [] },
      }),
    )

    renderSettingsPage("/settings/budgets")

    expect(await screen.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Create budget" })).toBeInTheDocument()
  })

  test("空状態から月予算を作成すると最新の月予算として表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [] },
      }),
    )

    const { user, baseElement } = renderSettingsPage("/settings/budgets")

    await user.click(await screen.findByRole("button", { name: "Create budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Create monthly budget" })
    const body = within(baseElement)

    await fillCreateMonthlyBudgetForm(user, dialog, body)
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create monthly budget" }),
      ).not.toBeInTheDocument()
    })
    expect(await screen.findByText("￥300,000")).toBeInTheDocument()
  })

  test("作成失敗時は既存のエラー表示を維持する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [] },
        create: {
          error: true,
          errorResponse: {
            code: POSTGRES_UNIQUE_VIOLATION_CODE,
            message: "duplicate key value violates unique constraint",
          },
        },
      }),
    )

    const { user, baseElement } = renderSettingsPage("/settings/budgets")

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
