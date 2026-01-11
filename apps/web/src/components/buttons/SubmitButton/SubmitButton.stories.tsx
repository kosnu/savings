import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { SubmitButton } from "./SubmitButton"

const meta = {
  title: "Common/Buttons/SubmitButton",
  component: SubmitButton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole("button", { name: /submit/i })

    expect(button).toBeDisabled()
    const spinner = within(button).getByLabelText(/loading/i)
    expect(spinner).toBeInTheDocument()
  },
}
