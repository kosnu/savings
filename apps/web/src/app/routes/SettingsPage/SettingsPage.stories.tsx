import type { Meta, StoryObj } from "@storybook/react-vite"
import { createRoute } from "@tanstack/react-router"
import { expect, within } from "storybook/test"

import { BookSettings } from "../../../features/books/bookSettings/BookSettings"
import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { createCategorySettingsHandlers } from "../../../test/msw/handlers/categorySettings"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { SettingsPage } from "./SettingsPage"

const meta = {
  title: "Pages/SettingsPage",
  component: SettingsPage,
  tags: ["autodocs", "browser-test"],
} satisfies Meta<typeof SettingsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [createStoryRouter("/settings")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(canvas.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings")
    expect(canvas.getByRole("link", { name: "Book" })).toHaveAttribute("href", "/settings/book")
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
    expect(await canvas.findByText("￥50,000")).toBeInTheDocument()
    expect(await canvas.findByText("Name")).toBeInTheDocument()
    expect(await canvas.findAllByText("Monthly budget")).not.toHaveLength(0)
    expect(await canvas.findAllByText("Pin")).not.toHaveLength(0)
  },
}
