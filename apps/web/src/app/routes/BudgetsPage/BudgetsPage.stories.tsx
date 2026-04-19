import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { BudgetsPage } from "./BudgetsPage"

const meta = {
  title: "Pages/BudgetsPage",
  component: BudgetsPage,
  parameters: {
    msw: {
      handlers: [
        ...createMonthlyBudgetHandlers({
          list: { response: [monthlyBudgets[3], monthlyBudgets[2], monthlyBudgets[1]] },
        }),
      ],
    },
  },
  tags: ["autodocs", "browser-test"],
  decorators: [createStoryRouter("/budgets")],
  argTypes: {},
  args: {},
} satisfies Meta<typeof BudgetsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByRole("heading", { name: "Budgets" })).toBeInTheDocument()
    expect(canvas.getByRole("button", { name: "Create budget" })).toBeInTheDocument()
    const table = await canvas.findByRole("table")
    expect(await within(table).findByText("2025/07")).toBeInTheDocument()
    expect(await within(table).findByText("￥75,000")).toBeInTheDocument()
  },
}

export const Empty: Story = {
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

    expect(await canvas.findByText("No monthly budgets yet.")).toBeInTheDocument()
  },
}

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createMonthlyBudgetHandlers({
          list: { response: [], durationOrMode: "infinite" },
        }),
      ],
    },
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getAllByLabelText("loading monthly budget")).toHaveLength(3)
  },
}

export const FetchError: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createMonthlyBudgetHandlers({
          list: { error: true },
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(
      await canvas.findByText("Could not load monthly budgets.", {}, { timeout: 3000 }),
    ).toBeInTheDocument()
  },
}
