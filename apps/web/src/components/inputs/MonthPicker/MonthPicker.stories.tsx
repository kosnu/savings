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

    // 月のセレクトを確認
    const marchText = await canvas.findByText("3月")
    expect(marchText).toBeInTheDocument()

    // 月のセレクトをクリック
    await userEvent.click(marchText)

    // 5月を選択
    const body = canvasElement.ownerDocument.body
    const mayOption = await within(body).findByRole("option", {
      name: "5月",
    })

    await userEvent.click(mayOption)

    // 選択後に5月が表示されることを確認
    const mayText = await canvas.findByText("5月")
    expect(mayText).toBeInTheDocument()
  },
}
