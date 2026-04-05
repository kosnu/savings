import type { Meta, StoryObj } from "@storybook/react-vite"

import { SubmitIconButton } from "./SubmitIconButton"

const meta = {
  title: "Features/PaymentDetails/SubmitIconButton",
  component: SubmitIconButton,
  args: {
    ariaLabel: "Save amount",
  },
} satisfies Meta<typeof SubmitIconButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = {
  args: {
    loading: true,
  },
}
