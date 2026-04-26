import type { Meta, StoryObj } from "@storybook/react-vite"
import { createRoute } from "@tanstack/react-router"
import { expect, within } from "storybook/test"

import { LatestMonthlyBudget } from "../../../features/budgets/latestMonthlyBudget"
import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createStoryRouter } from "../../../test/helpers/routerDecorator"
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
        component: LatestMonthlyBudget,
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
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await canvas.findByText("￥75,000")).toBeInTheDocument()
  },
}

export const EmptyBudgetSettings: Story = {
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
        component: LatestMonthlyBudget,
      })

      return [settingsRoute.addChildren([settingsBudgetsRoute])]
    }),
  ],
  parameters: {
    msw: {
      handlers: [
        ...createMonthlyBudgetHandlers({
          list: { response: [] },
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await canvas.findByRole("button", { name: "Create budget" })).toBeInTheDocument()
  },
}
