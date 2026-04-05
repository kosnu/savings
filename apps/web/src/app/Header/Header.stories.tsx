import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"

import { createStoryRouter } from "../../test/helpers/routerDecorator"
import { Header } from "./Header"

const meta = {
  title: "Shared/Header",
  component: Header,
  tags: ["autodocs"],
  decorators: [createStoryRouter("/")],
} satisfies Meta<typeof Header>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onMenuClick: fn(),
  },
}
