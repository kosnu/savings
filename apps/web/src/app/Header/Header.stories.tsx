import { PlusIcon } from "@radix-ui/react-icons"
import { Button } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"

import { createStoryRouter } from "../../test/helpers/routerDecorator"
import { Header } from "./Header"

const meta = {
  title: "App/Header",
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

export const WithAction: Story = {
  args: {
    onMenuClick: fn(),
    sticky: true,
    action: (
      <Button>
        <PlusIcon aria-hidden />
        Create payment
      </Button>
    ),
  },
}
