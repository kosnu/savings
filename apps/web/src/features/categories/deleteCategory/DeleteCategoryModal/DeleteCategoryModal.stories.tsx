import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

import { createCategorySettingsHandlers } from "../../../../test/msw/handlers/categorySettings"
import { DeleteCategoryModal } from "./DeleteCategoryModal"

const meta = {
  title: "Features/Categories/DeleteCategory/DeleteCategoryModal",
  component: DeleteCategoryModal,
  tags: ["autodocs"],
  args: { category: { id: 10, name: "Food" } },
  parameters: { msw: { handlers: createCategorySettingsHandlers() } },
} satisfies Meta<typeof DeleteCategoryModal>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete Food category" }),
    )
    await within(document.body).findByRole("dialog")
  },
}

export const Pending: Story = {
  parameters: {
    msw: { handlers: createCategorySettingsHandlers({ delete: { durationOrMode: "infinite" } }) },
  },
  play: async ({ canvasElement }) => {
    const body = within(document.body)
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete Food category" }),
    )
    const dialog = within(await body.findByRole("dialog"))
    const submitButton = dialog.getByRole("button", { name: "Delete" })
    await userEvent.click(submitButton)
    await expect(submitButton).toBeDisabled()
  },
}

export const Failed: Story = {
  parameters: { msw: { handlers: createCategorySettingsHandlers({ delete: { error: true } }) } },
  play: async ({ canvasElement }) => {
    const body = within(document.body)
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete Food category" }),
    )
    const dialog = within(await body.findByRole("dialog"))
    await userEvent.click(dialog.getByRole("button", { name: "Delete" }))
    await expect(await body.findByText("Failed to delete category.")).toBeVisible()
    await expect(body.getByRole("dialog")).toBeVisible()
  },
}
