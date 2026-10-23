import { Separator } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"

import { getSupabaseClient } from "../../lib/supabase"
import { createStoryRouter } from "../../test/helpers/routerDecorator"
import { createAuthHandlers, createMockJwt } from "../../test/msw/handlers/auth"
import { Sidebar } from "./Sidebar"
import { SidebarButton } from "./SidebarButton"

const meta: Meta<typeof Sidebar> = {
  title: "App/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [createStoryRouter("/")],
  argTypes: {
    open: { control: "boolean" },
  },
  args: {
    onClose: fn(),
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    open: true,
    children: "Sidebar Content",
  },
}

export const Closed: Story = {
  args: {
    open: false,
    children: "Sidebar Content",
  },
}

// 実際のナビゲーションの高さとviewport内の操作可能領域をブラウザで確認する。
export const ShortViewport: Story = {
  tags: ["browser-test"],
  parameters: {
    viewport: {
      options: {
        short: { name: "Short viewport", styles: { width: "320px", height: "240px" } },
        mobile: { name: "Mobile", styles: { width: "320px", height: "568px" } },
        landscape: { name: "Landscape", styles: { width: "568px", height: "320px" } },
      },
    },
  },
  globals: { viewport: { value: "short" } },
  args: {
    open: true,
    children: (
      <>
        <SidebarButton to="/" ariaLabel="Home" label="Home" />
        <SidebarButton to="/payments" ariaLabel="Payments" label="Payments" />
        <Separator orientation="horizontal" size="4" decorative />
        <SidebarButton to="/settings" ariaLabel="Settings" label="Settings" />
      </>
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const sidebar = await canvas.findByRole("complementary")
    const logout = await canvas.findByRole("button", { name: "Log out" })
    const bounds = logout.getBoundingClientRect()
    const sidebarBounds = sidebar.getBoundingClientRect()

    expect(bounds.height).toBeGreaterThan(0)
    expect(bounds.top).toBeGreaterThanOrEqual(sidebarBounds.top)
    expect(bounds.bottom).toBeLessThanOrEqual(sidebarBounds.bottom)
    expect(bounds.right).toBeLessThanOrEqual(window.innerWidth)
    expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(
      document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
    ).toBe(logout)

    const settings = await canvas.findByRole("link", { name: "Settings" })
    settings.scrollIntoView({ block: "nearest" })
    const settingsBounds = settings.getBoundingClientRect()
    expect(settingsBounds.top).toBeGreaterThanOrEqual(sidebarBounds.top)
    expect(settingsBounds.bottom).toBeLessThanOrEqual(logout.getBoundingClientRect().top)
    expect(
      document.elementFromPoint(
        settingsBounds.x + settingsBounds.width / 2,
        settingsBounds.y + settingsBounds.height / 2,
      ),
    ).toBe(settings)

    await userEvent.click(logout)
    await waitFor(async () => expect(args.onClose).toHaveBeenCalledTimes(1))
  },
}

export const MobileViewport: Story = {
  ...ShortViewport,
  globals: { viewport: { value: "mobile" } },
}

export const LandscapeViewport: Story = {
  ...ShortViewport,
  globals: { viewport: { value: "landscape" } },
}

export const LoggingOut: Story = {
  args: { open: true },
  parameters: { msw: { handlers: createAuthHandlers({ logout: { durationOrMode: "infinite" } }) } },
  play: async ({ canvasElement }) => {
    await getSupabaseClient().auth.setSession({
      access_token: createMockJwt(),
      refresh_token: "mock-refresh-token",
    })
    const canvas = within(canvasElement)
    const logout = await canvas.findByRole("button", { name: "Log out" })
    await userEvent.click(logout)
    await expect(logout).toBeDisabled()
  },
}

export const LogoutError: Story = {
  args: { open: true },
  parameters: { msw: { handlers: createAuthHandlers({ logout: { error: true } }) } },
  play: async ({ canvasElement }) => {
    await getSupabaseClient().auth.setSession({
      access_token: createMockJwt(),
      refresh_token: "mock-refresh-token",
    })
    const canvas = within(canvasElement)
    const logout = await canvas.findByRole("button", { name: "Log out" })
    await userEvent.click(logout)
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Could not log out. Please try again.",
    )
  },
}
