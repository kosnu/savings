import type { Meta, StoryObj } from "@storybook/react-vite"
import { createRoute } from "@tanstack/react-router"
import { expect, within } from "storybook/test"

import { BudgetSettings } from "../../../features/budgets/budgetSettings/BudgetSettings"
import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { createCategoryBudgetHandlers } from "../../../test/msw/handlers/categoryBudgets"
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
    expect(canvas.getByRole("link", { name: "Budgets" })).toHaveAttribute(
      "href",
      "/settings/budgets",
    )
  },
}

export const BudgetManagement: Story = {
  decorators: [
    createStoryRouter("/settings/budgets", (root, Story) => {
      const settingsRoute = createRoute({
        getParentRoute: () => root,
        path: "/settings",
        component: Story,
      })

      const settingsBudgetsRoute = createRoute({
        getParentRoute: () => settingsRoute,
        path: "budgets",
        component: BudgetSettings,
      })

      return [settingsRoute.addChildren([settingsBudgetsRoute])]
    }),
  ],
  parameters: {
    msw: {
      handlers: [
        ...createMonthlyBudgetHandlers({
          list: { response: [monthlyBudgets[3]] },
        }),
        ...createCategoryBudgetHandlers(),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await canvas.findByText("Category Budgets")).toBeInTheDocument()
  },
}
