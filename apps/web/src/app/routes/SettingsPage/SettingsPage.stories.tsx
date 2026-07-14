import type { Meta, StoryObj } from "@storybook/react-vite"
import { createRoute } from "@tanstack/react-router"
import { expect, within } from "storybook/test"

import { BookSettings } from "../../../features/books"
import { ProfileSettings } from "../../../features/profile"
import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { createCategorySettingsHandlers } from "../../../test/msw/handlers/categorySettings"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { SettingsOverview } from "../SettingsOverview"
import { SettingsPage } from "./SettingsPage"

const meta = {
  title: "Pages/SettingsPage",
  component: SettingsPage,
  tags: ["autodocs", "browser-test"],
} satisfies Meta<typeof SettingsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    createStoryRouter("/settings", (root, Story) => {
      const settingsRoute = createRoute({
        getParentRoute: () => root,
        path: "/settings",
        component: Story,
      })

      const settingsIndexRoute = createRoute({
        getParentRoute: () => settingsRoute,
        path: "/",
        component: SettingsOverview,
      })

      return [settingsRoute.addChildren([settingsIndexRoute])]
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(await canvas.findByText("Choose a setting to manage.")).toBeInTheDocument()
    const profileOverviewLink = canvas
      .getAllByRole("link", { name: /Profile/ })
      .find((link) => link.textContent?.includes("Change the language used by the app."))
    expect(profileOverviewLink?.getAttribute("href")).toBe("/settings/profile")

    const bookOverviewLink = canvas
      .getAllByRole("link", { name: /Book/ })
      .find((link) => link.textContent?.includes("Manage monthly budgets and categories."))
    expect(bookOverviewLink?.getAttribute("href")).toBe("/settings/book")
    expect(canvas.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings")
    expect(canvas.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/settings/profile",
    )
    expect(canvas.getByRole("link", { name: "Book" })).toHaveAttribute("href", "/settings/book")
  },
}

export const Profile: Story = {
  decorators: [
    createStoryRouter("/settings/profile", (root, Story) => {
      const settingsRoute = createRoute({
        getParentRoute: () => root,
        path: "/settings",
        component: Story,
      })

      const settingsProfileRoute = createRoute({
        getParentRoute: () => settingsRoute,
        path: "profile",
        component: ProfileSettings,
      })

      return [settingsRoute.addChildren([settingsProfileRoute])]
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByText("Language")).toBeInTheDocument()
    expect(await canvas.findByRole("combobox", { name: "Language" })).toBeInTheDocument()
  },
}

export const BookManagement: Story = {
  decorators: [
    createStoryRouter("/settings/book", (root, Story) => {
      const settingsRoute = createRoute({
        getParentRoute: () => root,
        path: "/settings",
        component: Story,
      })

      const settingsBookRoute = createRoute({
        getParentRoute: () => settingsRoute,
        path: "book",
        component: BookSettings,
      })

      return [settingsRoute.addChildren([settingsBookRoute])]
    }),
  ],
  parameters: {
    msw: {
      handlers: [
        ...createMonthlyBudgetHandlers({
          list: { response: [monthlyBudgets[3]] },
        }),
        ...createCategorySettingsHandlers(),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await canvas.findByText("Categories")).toBeInTheDocument()
    expect(await canvas.findByText("Food")).toBeInTheDocument()
    expect(await canvas.findByText("Name")).toBeInTheDocument()
    expect(await canvas.findAllByText("Pin")).not.toHaveLength(0)
  },
}
