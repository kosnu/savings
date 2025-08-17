import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { NoteField } from "./NoteField"

const meta = {
  title: "Features/CreatePayment/NoteField",
  component: NoteField,
  args: {},
} satisfies Meta<typeof NoteField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)

    const textfield = canvas.getByRole("textbox", { name: /note/i })
    await userEvent.type(textfield, "This is a note")

    expect(textfield).toHaveValue("This is a note")
  },
}

export const HasError: Story = {
  args: {
    error: true,
    messages: ["This field is required"],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByText("This field is required")).toBeInTheDocument()
  },
}
