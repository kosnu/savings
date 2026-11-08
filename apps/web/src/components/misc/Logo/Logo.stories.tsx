import type { Meta, StoryObj } from "@storybook/react-vite"

import { Logo } from "./Logo"

const meta = {
  title: "Components/Misc/Logo",
  component: Logo,
} satisfies Meta<typeof Logo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SignIn: Story = {
  args: { width: 48, height: 48 },
}

export const Animated: Story = {
  args: { width: 96, height: 96, animated: true },
}
