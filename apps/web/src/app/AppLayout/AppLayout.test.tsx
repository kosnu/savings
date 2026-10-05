import { createRoute } from "@tanstack/react-router"
import { beforeEach, describe, expect, test } from "vite-plus/test"

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

    const homeRoute = createRoute({
      getParentRoute: () => root,
      path: "/",
      component: () => (
        <AppLayout>
          <div>Home page</div>
        </AppLayout>
      ),
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

    return [homeRoute, authenticatedRoute.addChildren([paymentsRoute, settingsRoute])]
  })
}

describe("AppLayout", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test("初期表示では Sidebar を閉じた状態にする", async () => {
    renderAppLayout()

    expect(await screen.findByRole("complementary")).toHaveAttribute("data-open", "false")
    expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument()
  })

  test("Sidebar に Home、Payments、Settings への導線を表示する", async () => {
    const { router, user } = renderAppLayout()

    await user.click(await screen.findByLabelText("Menu button"))
    expect(await screen.findByRole("complementary")).toHaveAttribute("data-open", "true")

    expect(
      await screen.findByRole("link", { name: "Navigate to Payments page" }),
    ).toBeInTheDocument()

    expect(screen.getByRole("link", { name: "Navigate to Home page" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Burneto — Home" })).toHaveAttribute("href", "/")

    const settingsLink = await screen.findByRole("link", { name: "Navigate to Settings page" })
    expect(settingsLink).toHaveAttribute("href", "/settings")

    await user.click(settingsLink)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/settings")
    })
    expect(await screen.findByText("Settings page")).toBeInTheDocument()
  })
})
