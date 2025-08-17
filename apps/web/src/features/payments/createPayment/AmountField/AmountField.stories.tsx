import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { AmountField } from "./AmountField"

const meta = {
  title: "Features/CreatePayment/AmountField",
  component: AmountField,
  args: {},
} satisfies Meta<typeof AmountField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)

    const textfield = canvas.getByRole("textbox", { name: /amount/i })
    await userEvent.type(textfield, "1000")

    expect(textfield).toHaveValue("1000")
  },
}

export const HasError: Story = {
  args: {
    error: true,
    message: "This field is required",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByText("This field is required")).toBeInTheDocument()
  },
}
