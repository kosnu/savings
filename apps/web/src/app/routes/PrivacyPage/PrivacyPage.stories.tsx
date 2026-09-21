import type { Meta, StoryObj } from "@storybook/react-vite"
import { I18nextProvider } from "react-i18next"
import { expect, within } from "storybook/test"

import { i18next } from "../../../i18n"
import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { PrivacyPage } from "./PrivacyPage"

const meta = {
  title: "Pages/PrivacyPage",
  component: PrivacyPage,
  tags: ["autodocs", "browser-test"],
  decorators: [createStoryRouter("/privacy")],
} satisfies Meta<typeof PrivacyPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Privacy policy",
    )
    await expect(canvas.getByRole("heading", { name: "Contact the operator" })).toBeVisible()
    await expect(canvas.getByRole("link", { name: "Back to Burneto" })).toHaveAttribute("href", "/")
  },
}

const japaneseI18n = i18next.cloneInstance({ lng: "ja" })

export const Japanese: Story = {
  decorators: [
    (Story) => (
      <I18nextProvider i18n={japaneseI18n}>
        <Story />
      </I18nextProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { level: 1 })).toHaveTextContent(
      "プライバシーポリシー",
    )
    await expect(canvas.getByRole("heading", { name: "運営者へのお問い合わせ" })).toBeVisible()
    await expect(canvas.getByRole("link", { name: "Burnetoに戻る" })).toHaveAttribute("href", "/")
  },
}
