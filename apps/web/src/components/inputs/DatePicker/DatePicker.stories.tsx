import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"

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
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(args.value)

    return <DatePicker {...args} value={selectedDate} onChange={(date) => setSelectedDate(date)} />
  },
} satisfies Meta<typeof DatePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const SelectToday: Story = {
  args: {
    value: new Date(2025, 4, 10),
  },
}
