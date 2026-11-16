import { createRoute } from "@tanstack/react-router"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { renderWithRouter } from "../../test/helpers/renderWithRouter"
import { screen, waitFor, within } from "../../test/test-utils"
import { AppLayout } from "./AppLayout"

function renderAppLayout(initialEntry = "/payments") {
  // 認証後の両ルートで使うレイアウトの接続を確認するため、Page Storyを経由しない。
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

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("初期表示では Sidebar を閉じた状態にする", async () => {
    renderAppLayout()

    expect(await screen.findByRole("button", { name: "Menu button" })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument()
    expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument()
  })

  test.each(["/", "/payments"])(
    "%s は以前の保存値が開いていても閉じて表示し、メニューを開閉できる",
    async (initialEntry) => {
      window.localStorage.setItem("sidebarOpen", "true")
      const { user } = renderAppLayout(initialEntry)

      const menu = await screen.findByRole("button", { name: "Menu button" })
      expect(menu).toHaveAttribute("aria-expanded", "false")
      expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument()

      await user.click(menu)
      expect(menu).toHaveAttribute("aria-expanded", "true")
      const close = screen.getByRole("button", { name: "Close sidebar" })
      expect(close).toHaveFocus()
      await user.click(close)
      expect(menu).toHaveAttribute("aria-expanded", "false")
      expect(menu).toHaveFocus()

      await user.click(menu)
      expect(menu).toHaveAttribute("aria-expanded", "true")
      await user.keyboard("{Escape}")
      expect(menu).toHaveAttribute("aria-expanded", "false")
      expect(menu).toHaveFocus()

      await user.click(menu)
      await user.click(screen.getByTestId("sidebar-backdrop"))
      expect(menu).toHaveAttribute("aria-expanded", "false")
      expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument()
    },
  )

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
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument()
  })

  test("PC ではメニューを開かずに移動でき、現在の画面を示す", async () => {
    const matchMedia = window.matchMedia.bind(window)
    vi.spyOn(window, "matchMedia").mockImplementation((query) =>
      Object.defineProperty(matchMedia(query), "matches", {
        value: query === "(min-width: 1024px)",
      }),
    )
    const { user } = renderAppLayout()
    const navigation = await screen.findByRole("navigation", { name: "Main navigation" })
    const payments = within(navigation).getByRole("link", { name: "Navigate to Payments page" })
    const settings = within(navigation).getByRole("link", { name: "Navigate to Settings page" })

    expect(screen.queryByRole("button", { name: "Menu button" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Close sidebar" })).not.toBeInTheDocument()
    expect(payments).toHaveAttribute("aria-current", "page")
    expect(
      within(navigation).getByRole("link", { name: "Navigate to Home page" }),
    ).not.toHaveAttribute("aria-current")

    await user.click(settings)
    expect(await screen.findByText("Settings page")).toBeVisible()
    expect(settings).toHaveAttribute("aria-current", "page")
    expect(payments).not.toHaveAttribute("aria-current")
  })
})
