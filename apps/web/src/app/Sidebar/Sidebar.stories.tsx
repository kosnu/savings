import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"

import { createStoryRouter } from "../../test/helpers/routerDecorator"
import { Sidebar } from "./Sidebar"

const meta = {
  title: "Shared/Sidebar/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [createStoryRouter("/")],
  argTypes: {
    open: { control: "boolean" },
  },
  args: {
    onClose: fn(),
  },
} satisfies Meta<typeof Sidebar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    open: true,
    children: "Sidebar Content",
  },
}

export const Closed: Story = {
  args: {
    open: false,
    children: "Sidebar Content",
  },
}
