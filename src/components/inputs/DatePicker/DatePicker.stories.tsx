import type { Meta, StoryObj } from "@storybook/react"
import { userEvent, within } from "@storybook/test"
import { screen } from "@testing-library/react"
import { DatePicker } from "./DatePicker"

const meta = {
  title: "Common/Inputs/DatePicker",
  component: DatePicker,
  parameters: {
    layout: "centered",
    mockingDate: new Date(2025, 4, 1),
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof DatePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: "Date",
    name: "date",
    mode: "single",
  },
}

export const Filled: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole("button", {
      name: /date/i,
    })
    await userEvent.click(button)

    const date = await screen.findByRole("button", {
      name: /today/i,
    })
    await userEvent.click(date)
    await userEvent.type(button, "{escape}")
  },
}
