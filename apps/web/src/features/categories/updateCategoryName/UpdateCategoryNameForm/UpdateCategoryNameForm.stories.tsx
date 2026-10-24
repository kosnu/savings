import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { expect, fn, userEvent, within } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createCategorySettingsHandlers } from "../../../../test/msw/handlers/categorySettings"
import { UpdateCategoryNameForm } from "./UpdateCategoryNameForm"

const meta = {
  title: "Features/Categories/UpdateCategoryName/UpdateCategoryNameForm",
  component: UpdateCategoryNameForm,
  parameters: {
    layout: "centered",
    msw: {
      handlers: createCategorySettingsHandlers(),
    },
  },
  tags: ["autodocs"],
  args: {
    category: {
      id: 10,
      name: "Food",
      pinned: true,
    },
    onCancel: fn(),
    onSuccess: fn(),
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
} satisfies Meta<typeof UpdateCategoryNameForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Saving: Story = {
  parameters: {
    msw: { handlers: createCategorySettingsHandlers({ update: { durationOrMode: "infinite" } }) },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: /Name/ })
    await userEvent.clear(input)
    await userEvent.type(input, "Groceries")
    const submitButton = canvas.getByRole("button", { name: "Save" })
    await userEvent.click(submitButton)
    await expect(submitButton).toBeDisabled()
  },
}

export const SaveError: Story = {
  parameters: { msw: { handlers: createCategorySettingsHandlers({ update: { error: true } }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: /Name/ })
    await userEvent.clear(input)
    await userEvent.type(input, "Groceries")
    await userEvent.click(canvas.getByRole("button", { name: "Save" }))
    await expect(await canvas.findByRole("alert")).toBeVisible()
  },
}
