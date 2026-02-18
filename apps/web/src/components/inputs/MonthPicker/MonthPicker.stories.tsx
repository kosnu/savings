import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { expect, userEvent, within } from "storybook/test"
import { MonthPicker } from "./MonthPicker"

const meta = {
  title: "Common/Inputs/MonthPicker",
  component: MonthPicker,
  parameters: {
    layout: "centered",
    mockingDate: new Date(2025, 4, 15),
  },
  tags: ["autodocs"],
  render: (args) => {
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(
      args.value,
    )

    return (
      <MonthPicker
        {...args}
        value={selectedDate}
        onChange={(date) => setSelectedDate(date)}
      />
    )
  },
} satisfies Meta<typeof MonthPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const WithValue: Story = {
  args: {
    value: new Date(2025, 4, 1),
  },
}

export const SelectMonth: Story = {
  tags: ["skip"],
  args: {
    value: new Date(2025, 2, 1),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const textbox = await canvas.findByRole("textbox")

    expect(textbox).toHaveValue("2025年3月")

    await userEvent.click(textbox)

    const body = canvasElement.ownerDocument.body
    const mayButton = await within(body).findByRole("button", {
      name: /5月/i,
    })

    await userEvent.click(mayButton)
    expect(textbox).toHaveValue("2025年5月")
  },
}
