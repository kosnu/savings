import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "@storybook/test"
import { OutlinedButton } from "./OutlinedButton"

const meta = {
  title: "Common/Buttons/OutlinedButton",
  component: OutlinedButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    variant: "outlined",
    onClick: fn(),
  },
} satisfies Meta<typeof OutlinedButton>

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
