import type { Meta, StoryObj } from "@storybook/react"
import { screen, userEvent, within } from "@storybook/test"
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

export const SelectToday: Story = {
  args: {
    label: "Date",
    name: "date",
    mode: "single",
    defaultValue: new Date(2025, 4, 10),
  },
  play: async ({ canvasElement }) => {
    const button = await within(canvasElement).findByRole("button", {
      name: /date/i,
    })

    await userEvent.click(button)

    // NOTE: `within(canvasElement)` を使えって言ってくるけど、 `screen` からでしか取得できないからこのままにする
    const todayButton = await screen.findByRole("button", {
      name: /today/i,
    })

    await userEvent.click(todayButton)
  },
}
