import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"

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
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(args.value)

    return (
      <MonthPicker
        {...args}
        value={selectedDate}
        onChange={(date) => {
          setSelectedDate(date)
          args.onChange?.(date)
        }}
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
