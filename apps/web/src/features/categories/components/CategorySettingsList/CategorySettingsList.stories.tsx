import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { createCategorySettingsHandlers } from "../../../../test/msw/handlers/categorySettings"
import { CategorySettingsList } from "./CategorySettingsList"

const meta = {
  title: "Features/Categories/Components/CategorySettingsList",
  component: CategorySettingsList,
  tags: ["autodocs"],
  parameters: {
    msw: {
      handlers: createCategorySettingsHandlers(),
    },
  },
} satisfies Meta<typeof CategorySettingsList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByLabelText("loading category settings"),
    ).toBeVisible()
  },
  parameters: { msw: { handlers: createCategorySettingsHandlers({ durationOrMode: "infinite" }) } },
}

export const FetchError: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Could not load categories.", {}, { timeout: 5000 }),
    ).toBeVisible()
  },
  parameters: { msw: { handlers: createCategorySettingsHandlers({ error: true }) } },
}
