import type { Meta, StoryObj } from "@storybook/react-vite"
import { SubmitButton } from "./SubmitButton"

const meta = {
  title: "Common/Buttons/SubmitButton",
  component: SubmitButton,
  tags: ["autodocs"],
} satisfies Meta<typeof SubmitButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: "Submit",
  },
}

export const Loading: Story = {
  args: {
    children: "Submit",
    loading: true,
  },
}
