import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { MonthlyBudgetList } from "./MonthlyBudgetList"

const meta = {
  title: "Features/Budgets/ListMonthlyBudget/MonthlyBudgetList",
  component: MonthlyBudgetList,
  tags: ["autodocs"],
  parameters: { msw: { handlers: createMonthlyBudgetHandlers() } },
} satisfies Meta<typeof MonthlyBudgetList>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findAllByLabelText("loading monthly budget"),
    ).toHaveLength(3)
  },
  parameters: {
    msw: { handlers: createMonthlyBudgetHandlers({ list: { durationOrMode: "infinite" } }) },
  },
}
export const FetchError: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(
        "Could not load monthly budgets.",
        {},
        { timeout: 5000 },
      ),
    ).toBeVisible()
  },
  parameters: { msw: { handlers: createMonthlyBudgetHandlers({ list: { error: true } }) } },
}
