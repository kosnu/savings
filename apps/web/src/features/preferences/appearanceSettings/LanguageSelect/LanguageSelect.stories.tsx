import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

import { i18next } from "../../../../i18n"
import { accountLanguageUpdateHandler } from "../../../../test/msw/handlers/profile"
import { LanguageSelect } from "./LanguageSelect"

const meta = {
  title: "Features/Preferences/AppearanceSettings/LanguageSelect",
  component: LanguageSelect,
  tags: ["autodocs"],
  beforeEach: async () => {
    await i18next.changeLanguage("en")
    return async () => {
      await i18next.changeLanguage("en")
    }
  },
} satisfies Meta<typeof LanguageSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Saving: Story = {
  parameters: {
    msw: {
      handlers: [
        accountLanguageUpdateHandler({ authUserId: "mock-user-id", durationOrMode: "infinite" }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole("combobox", { name: "Language" }))
    await userEvent.click(await body.findByRole("option", { name: "Japanese" }))
    await expect(await canvas.findByRole("combobox", { name: "言語" })).toBeDisabled()
  },
}

export const SaveError: Story = {
  parameters: {
    msw: { handlers: [accountLanguageUpdateHandler({ authUserId: "mock-user-id", error: true })] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole("combobox", { name: "Language" }))
    await userEvent.click(await body.findByRole("option", { name: "Japanese" }))
    await expect(await body.findByText("Could not save your language.")).toBeVisible()
    await expect(canvas.getByRole("combobox", { name: "Language" })).toHaveTextContent("English")
  },
}
