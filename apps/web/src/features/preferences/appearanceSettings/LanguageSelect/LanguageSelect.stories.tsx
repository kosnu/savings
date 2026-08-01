import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { createProfileHandlers } from "../../../../test/msw/handlers/profile"
import { LanguageSelect } from "./LanguageSelect"

const meta = {
  title: "Features/Preferences/AppearanceSettings/LanguageSelect",
  component: LanguageSelect,
  tags: ["autodocs"],
  parameters: {
    msw: {
      handlers: createProfileHandlers(),
    },
  },
} satisfies Meta<typeof LanguageSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Saving: Story = {
  parameters: {
    msw: {
      handlers: createProfileHandlers({ update: { durationOrMode: "infinite" } }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const documentBody = within(canvasElement.ownerDocument.body)
    const select = await canvas.findByRole("combobox", { name: "Language" })

    await waitFor(async () => await expect(select).toBeEnabled())
    await userEvent.click(select)
    await userEvent.click(await documentBody.findByRole("option", { name: "Japanese" }))

    await expect(select).toBeDisabled()
  },
}
