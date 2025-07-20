import type { Meta, StoryObj } from "@storybook/react-vite"
import { Paper } from "./Paper"

const meta = {
  title: "Common/Misc/Paper",
  component: Paper,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof Paper>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: "Paper",
  },
}
