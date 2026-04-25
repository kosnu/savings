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

    const settingsRoute = createRoute({
      getParentRoute: () => authenticatedRoute,
      path: "/settings",
      component: () => <div>Settings page</div>,
    })

    return [authenticatedRoute.addChildren([paymentsRoute, settingsRoute])]
  })
}

describe("AppLayout", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test("Sidebar に Payments と Settings への導線を表示する", async () => {
    const { router, user } = renderAppLayout()

    expect(
      await screen.findByRole("link", { name: "Navigate to Payments page" }),
    ).toBeInTheDocument()

    const settingsLink = await screen.findByRole("link", { name: "Navigate to Settings page" })
    expect(settingsLink).toHaveAttribute("href", "/settings")

    await user.click(settingsLink)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/settings")
    })
    expect(await screen.findByText("Settings page")).toBeInTheDocument()
  })
})
