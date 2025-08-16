import type { Meta, StoryObj } from "@storybook/react-vite"
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
  tags: ["skip"],
  args: {
    label: "Date",
    name: "date",
    mode: "single",
    defaultValue: new Date(2025, 4, 10),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = await canvas.findByRole("button", {
      name: /date/i,
    })

    await userEvent.click(button)

    const body = canvasElement.ownerDocument.body
    const todayButton = await within(body).findByRole("button", {
      name: /today/i,
    })

    await userEvent.click(todayButton)
    await canvas.findByText("2025/05/01")
  },
}

export const HasError: Story = {
  args: {
    label: "Date",
    name: "date",
    mode: "single",
    error: { message: "Category is empty" },
    helperText: "Category is empty",
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByText("Category is empty")).toBeInTheDocument()
  },
}
