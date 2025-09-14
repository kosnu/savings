import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { Header } from "./Header"

const meta = {
  title: "Shared/Header",
  component: Header,
  tags: ["autodocs"],
  args: {
    onMenuClick: fn(),
  },
} satisfies Meta<typeof Header>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
