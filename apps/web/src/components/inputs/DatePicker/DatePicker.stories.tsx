import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { expect, userEvent, within } from "storybook/test"
import { DatePicker } from "./DatePicker"

const meta = {
  title: "Common/Inputs/DatePicker",
  component: DatePicker,
  parameters: {
    layout: "centered",
    mockingDate: new Date(2025, 4, 1),
  },
  tags: ["autodocs"],
  render: (args) => {
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(
      args.value,
    )

    return (
      <DatePicker
        {...args}
        value={selectedDate}
        onChange={(date) => setSelectedDate(date)}
      />
    )
  },
} satisfies Meta<typeof DatePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const SelectToday: Story = {
  tags: ["skip"],
  args: {
    value: new Date(2025, 4, 10),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const textbox = await canvas.findByRole("textbox")

    await userEvent.click(textbox)

    const body = canvasElement.ownerDocument.body
    const todayButton = await within(body).findByRole("button", {
      name: /今日/i,
    })

    await userEvent.click(todayButton)
    expect(textbox).toHaveValue("2025/05/01")
  },
}
