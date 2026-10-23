import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { RemoveMonthlyBudgetModal } from "./RemoveMonthlyBudgetModal"

const meta = {
  title: "Features/Budgets/RemoveMonthlyBudget/RemoveMonthlyBudgetModal",
  component: RemoveMonthlyBudgetModal,
  tags: ["autodocs"],
  args: { monthlyBudgetId: 3 },
  parameters: { msw: { handlers: createMonthlyBudgetHandlers() } },
} satisfies Meta<typeof RemoveMonthlyBudgetModal>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Remove budget" }))
    await within(document.body).findByRole("dialog")
  },
}

export const Pending: Story = {
  parameters: {
    msw: {
      handlers: createMonthlyBudgetHandlers({
        remove: { allowedMonthlyBudgetId: 3, durationOrMode: "infinite" },
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(document.body)
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Remove budget" }))
    const dialog = within(await body.findByRole("dialog"))
    await userEvent.click(dialog.getByRole("button", { name: "Remove" }))
    await expect(dialog.getByRole("button", { name: "Remove" })).toBeDisabled()
  },
}

export const Failed: Story = {
  parameters: {
    msw: {
      handlers: createMonthlyBudgetHandlers({ remove: { allowedMonthlyBudgetId: 3, error: true } }),
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(document.body)
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Remove budget" }))
    const dialog = within(await body.findByRole("dialog"))
    await userEvent.click(dialog.getByRole("button", { name: "Remove" }))
    await waitFor(async () =>
      expect(body.getByText("Failed to remove monthly budget.")).toBeVisible(),
    )
    await waitFor(async () => expect(body.getByRole("dialog")).toBeVisible())
  },
}
