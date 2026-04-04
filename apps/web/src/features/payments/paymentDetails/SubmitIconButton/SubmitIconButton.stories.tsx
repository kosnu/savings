import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

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

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByRole("button", { name: /save amount/i })).toBeInTheDocument()
  },
}

export const Loading: Story = {
  args: {
    loading: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByLabelText("saving")).toBeInTheDocument()
  },
}
