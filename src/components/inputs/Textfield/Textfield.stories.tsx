import type { Meta, StoryObj } from "@storybook/react"
import { userEvent, within } from "@storybook/test"
import { Textfield } from "./Textfield"

const meta = {
  title: "Common/Inputs/Textfield",
  component: Textfield,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof Textfield>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: "Name",
    name: "name",
  },
}

export const Filled: Story = {
  args: {
    label: "Name",
    name: "name",
    type: "text",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole("textbox"), "John Doe")
  },
}
