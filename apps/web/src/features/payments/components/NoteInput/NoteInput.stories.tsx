import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"

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

export const Default: Story = {}

export const Filled: Story = {
  args: {
    value: "Existing note",
  },
}
