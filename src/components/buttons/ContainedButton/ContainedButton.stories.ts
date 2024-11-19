import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "@storybook/test"
import { ContainedButton } from "./ContainedButton"

const meta = {
  title: "Common/Buttons/ContainedButton",
  component: ContainedButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onClick: fn(),
  },
} satisfies Meta<typeof ContainedButton>

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
