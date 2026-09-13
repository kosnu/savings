import type { Meta, StoryObj } from "@storybook/react-vite"
import { createRoute } from "@tanstack/react-router"
import { expect, within } from "storybook/test"

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
    await expect(await canvas.findByRole("heading", { level: 1 })).toHaveTextContent("My Savings")
    await expect(canvas.getByRole("link")).toHaveAttribute("href", "/auth")
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "68000")
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "100000")
  },
}
