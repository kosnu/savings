import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { expect, fn, userEvent, within } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { CreateMonthlyBudgetForm } from "./CreateMonthlyBudgetForm"

const meta = {
  title: "Features/Budgets/CreateMonthlyBudget/CreateMonthlyBudgetForm",
  component: CreateMonthlyBudgetForm,
  parameters: {
    layout: "centered",
    mockingDate: new Date(2025, 5, 2),
    msw: { handlers: createMonthlyBudgetHandlers() },
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onCancel: fn(),
  },
  decorators: (Story) => {
    const queryClient = createQueryClient()

    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      </ThemeProvider>
    )
  },
} satisfies Meta<typeof CreateMonthlyBudgetForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onSuccess: fn(),
    onError: fn(),
  },
}

export const Saving: Story = {
  parameters: {
    msw: { handlers: createMonthlyBudgetHandlers({ create: { durationOrMode: "infinite" } }) },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole("combobox", { name: "Year" }))
    await userEvent.click(await body.findByRole("option", { name: "2025" }))
    await userEvent.click(canvas.getByRole("combobox", { name: "Month" }))
    await userEvent.click(await body.findByRole("option", { name: "June" }))
    await userEvent.type(canvas.getByRole("textbox", { name: /amount/i }), "30000")
    const submitButton = canvas.getByRole("button", { name: "Create" })
    await userEvent.click(submitButton)
    await expect(submitButton).toBeDisabled()
  },
}

export const SaveError: Story = {
  parameters: { msw: { handlers: createMonthlyBudgetHandlers({ create: { error: true } }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole("combobox", { name: "Year" }))
    await userEvent.click(await body.findByRole("option", { name: "2025" }))
    await userEvent.click(canvas.getByRole("combobox", { name: "Month" }))
    await userEvent.click(await body.findByRole("option", { name: "June" }))
    await userEvent.type(canvas.getByRole("textbox", { name: /amount/i }), "30000")
    await userEvent.click(canvas.getByRole("button", { name: "Create" }))
    await expect(await canvas.findByRole("alert")).toBeVisible()
  },
}
