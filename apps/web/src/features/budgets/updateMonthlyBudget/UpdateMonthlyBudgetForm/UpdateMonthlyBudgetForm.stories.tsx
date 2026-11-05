import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"

import { monthlyBudgets } from "../../../../test/data/monthlyBudgets"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { normalizeMonthlyBudgetRow, toMonthlyBudget } from "../../monthlyBudgetMappers"
import { UpdateMonthlyBudgetForm } from "./UpdateMonthlyBudgetForm"

const monthlyBudget = toMonthlyBudget(normalizeMonthlyBudgetRow(monthlyBudgets[2]))
const meta = {
  title: "Features/Budgets/UpdateMonthlyBudget/UpdateMonthlyBudgetForm",
  component: UpdateMonthlyBudgetForm,
  tags: ["autodocs"],
  args: { monthlyBudget, onCancel: fn(), onSuccess: fn() },
  parameters: {
    msw: {
      handlers: createMonthlyBudgetHandlers({
        update: { allowedMonthlyBudgetId: monthlyBudget.id },
      }),
    },
  },
} satisfies Meta<typeof UpdateMonthlyBudgetForm>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Saving: Story = {
  parameters: {
    msw: {
      handlers: createMonthlyBudgetHandlers({
        update: { allowedMonthlyBudgetId: monthlyBudget.id, durationOrMode: "infinite" },
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: /amount/i })
    await userEvent.clear(input)
    await userEvent.type(input, "70000")
    const submitButton = canvas.getByRole("button", { name: "Save" })
    await userEvent.click(submitButton)
    await expect(submitButton).toBeDisabled()
  },
}

export const SaveError: Story = {
  parameters: {
    msw: {
      handlers: createMonthlyBudgetHandlers({
        update: { allowedMonthlyBudgetId: monthlyBudget.id, error: true },
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: /amount/i })
    await userEvent.clear(input)
    await userEvent.type(input, "70000")
    await userEvent.click(canvas.getByRole("button", { name: "Save" }))
    await expect(await canvas.findByRole("alert")).toBeVisible()
  },
}
