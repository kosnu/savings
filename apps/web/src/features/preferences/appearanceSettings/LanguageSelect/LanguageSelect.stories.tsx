import type { Meta, StoryObj } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { expect, userEvent, within } from "storybook/test"

import { LanguageSyncProvider } from "../../../../providers/language/LanguageSyncProvider"
import { LanguageSelect } from "./LanguageSelect"

const meta = {
  title: "Features/Preferences/AppearanceSettings/LanguageSelect",
  component: LanguageSelect,
  tags: ["autodocs"],
} satisfies Meta<typeof LanguageSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

function createConfirmationFailureHandlers() {
  let getRequestCount = 0

  return [
    http.get("*/rest/v1/users*", () => {
      getRequestCount += 1

      if (getRequestCount > 1) {
        return HttpResponse.json({ message: "Failed to fetch profile." }, { status: 500 })
      }

      return HttpResponse.json({
        name: "Test User",
        email: "test@example.com",
        language: "en",
      })
    }),
    http.patch("*/rest/v1/users*", () => HttpResponse.json({ auth_user_id: "mock-user-id" })),
  ]
}

export const ConfirmationFailed: Story = {
  parameters: {
    msw: {
      handlers: createConfirmationFailureHandlers(),
    },
  },
  decorators: [
    (Story) => (
      <LanguageSyncProvider>
        <Story />
      </LanguageSyncProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const languageSelect = await canvas.findByRole("combobox", { name: "Language" })

    await userEvent.click(languageSelect)
    await userEvent.click(await canvas.findByRole("option", { name: "Japanese" }))

    expect(await canvas.findByRole("alert")).toHaveTextContent(
      "言語は保存されましたが、アカウント設定を確認できませんでした。",
    )
    expect(canvas.getByRole("combobox", { name: "言語" })).toBeDisabled()
    expect(canvas.getByRole("button", { name: "もう一度確認" })).toBeEnabled()
  },
}
