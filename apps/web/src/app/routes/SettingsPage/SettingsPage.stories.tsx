import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { SettingsPage } from "./SettingsPage"

const meta = {
  title: "Pages/SettingsPage",
  component: SettingsPage,
  decorators: [createStoryRouter("/settings")],
  tags: ["autodocs", "browser-test"],
} satisfies Meta<typeof SettingsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByRole("heading", { name: "Settings" })).toBeInTheDocument()
  },
}
