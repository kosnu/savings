import { createRoute } from "@tanstack/react-router"
import { beforeEach, describe, expect, test } from "vitest"

import { renderWithRouter } from "../../test/helpers/renderWithRouter"
import { screen, waitFor } from "../../test/test-utils"
import { AppLayout } from "./AppLayout"

function renderAppLayout(initialEntry = "/payments") {
  return renderWithRouter(initialEntry, (root) => {
    const authenticatedRoute = createRoute({
      getParentRoute: () => root,
      id: "authenticated",
      component: AppLayout,
    })

    const paymentsRoute = createRoute({
      getParentRoute: () => authenticatedRoute,
      path: "/payments",
      component: () => <div>Payments page</div>,
    })

    const budgetsRoute = createRoute({
      getParentRoute: () => authenticatedRoute,
      path: "/budgets",
      component: () => <div>Budgets page</div>,
    })

    return [authenticatedRoute.addChildren([paymentsRoute, budgetsRoute])]
  })
}

describe("AppLayout", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test("Sidebar に Payments と Budgets への導線を表示する", async () => {
    const { router, user } = renderAppLayout()

    expect(
      await screen.findByRole("link", { name: "Navigate to Payments page" }),
    ).toBeInTheDocument()

    const budgetsLink = await screen.findByRole("link", { name: "Navigate to Budgets page" })
    expect(budgetsLink).toHaveAttribute("href", "/budgets")

    await user.click(budgetsLink)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/budgets")
    })
    expect(await screen.findByText("Budgets page")).toBeInTheDocument()
  })
})
