import type { Meta, StoryObj } from "@storybook/react-vite"

import { CancelButton } from "./CancelButton"

const meta = {
  title: "Components/Buttons/CancelButton",
  component: CancelButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof CancelButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
