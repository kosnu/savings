import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { expect, within } from "storybook/test"

import { NoteInput } from "./NoteInput"

const meta = {
  title: "Features/Payments/Components/NoteInput",
  component: NoteInput,
  parameters: {
    layout: "centered",
  },
  render: (args) => {
    const [note, setNote] = useState(args.value ?? "")

    return <NoteInput {...args} value={note} onChange={setNote} />
  },
} satisfies Meta<typeof NoteInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)

    const input = canvas.getByRole("textbox")
    await userEvent.type(input, "This is a note")

    expect(input).toHaveValue("This is a note")
  },
}

export const Filled: Story = {
  args: {
    value: "Existing note",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByRole("textbox")).toHaveValue("Existing note")
  },
}
