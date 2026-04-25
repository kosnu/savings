import { createRoute, redirect } from "@tanstack/react-router"
import { describe, expect, test } from "vite-plus/test"

import { renderWithRouter } from "../../../test/helpers/renderWithRouter"
import { screen, waitFor } from "../../../test/test-utils"
import { SettingsPage } from "./SettingsPage"

function renderSettingsPage(initialEntry = "/settings") {
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
      getParentRoute: () => authenticatedRoute,
      path: "/settings/budgets",
      component: SettingsPage,
    })

    const legacyBudgetsRoute = createRoute({
      getParentRoute: () => authenticatedRoute,
      path: "/budgets",
      beforeLoad: () => {
        throw redirect({ to: "/settings/budgets" })
      },
    })

    return [
      authenticatedRoute.addChildren([settingsRoute, settingsBudgetsRoute, legacyBudgetsRoute]),
    ]
  })
}

describe("SettingsPage", () => {
  test("Settings 見出しと Budgets への導線を表示する", async () => {
    renderSettingsPage()

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument()

    const settingsLink = await screen.findByRole("link", { name: "Settings" })
    expect(settingsLink).toHaveAttribute("href", "/settings")

    const budgetsLink = await screen.findByRole("link", { name: "Budgets" })
    expect(budgetsLink).toHaveAttribute("href", "/settings/budgets")
  })

  test("Budgets 導線から予算設定へ遷移する", async () => {
    const { router, user } = renderSettingsPage()

    await user.click(await screen.findByRole("link", { name: "Budgets" }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/settings/budgets")
    })
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument()
  })

  test("/budgets から予算設定へ到達できる", async () => {
    const { router } = renderSettingsPage("/budgets")

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/settings/budgets")
    })
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument()
  })
})
