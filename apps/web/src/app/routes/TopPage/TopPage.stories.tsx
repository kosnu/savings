import { Theme } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { createRoute } from "@tanstack/react-router"
import { I18nextProvider } from "react-i18next"
import { expect, within } from "storybook/test"

import { i18next } from "../../../i18n"
import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { AuthPage } from "../AuthPage"
import { TopPage } from "./TopPage"

const meta = {
  title: "Pages/TopPage",
  component: TopPage,
  parameters: {},
  tags: ["autodocs", "browser-test"],
  decorators: [
    createStoryRouter("/", (root, Story) => [
      createRoute({ getParentRoute: () => root, path: "/", component: Story }),
      createRoute({ getParentRoute: () => root, path: "/auth", component: AuthPage }),
    ]),
  ],
  argTypes: {},
  args: {},
} satisfies Meta<typeof TopPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Know what’s left.",
    )
    await expect(canvas.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/auth")
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "68000")
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "100000")
  },
}

const japaneseI18n = i18next.cloneInstance({ lng: "ja" })

export const Japanese: Story = {
  decorators: [
    (Story) => (
      <I18nextProvider i18n={japaneseI18n}>
        <Theme appearance="light">
          <Story />
        </Theme>
      </I18nextProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { level: 1 })).toHaveTextContent(
      "使えるお金が、",
    )
    await expect(canvas.getByRole("link", { name: "ログイン" })).toHaveAttribute("href", "/auth")
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "68000")
  },
}
