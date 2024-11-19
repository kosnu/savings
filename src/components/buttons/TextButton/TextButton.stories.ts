import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "@storybook/test"
import { TextButton } from "./TextButton"

const meta = {
  title: "Common/Buttons/TextButton",
  component: TextButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onClick: fn(),
  },
} satisfies Meta<typeof TextButton>

export default meta
type Story = StoryObj<typeof meta>

export const Small: Story = {
  args: {
    children: "Button",
    size: "small",
  },
}

export const Medium: Story = {
  args: {
    children: "Button",
    size: "medium",
  },
}

export const Large: Story = {
  args: {
    children: "Button",
    size: "large",
  },
}
