import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { NoteField } from "./NoteField"

const meta = {
  title: "Features/PaymentDetails/NoteField",
  component: NoteField,
  args: {
    note: "コンビニ",
  },
} satisfies Meta<typeof NoteField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByText("Note")).toBeInTheDocument()
    expect(canvas.getByText("コンビニ")).toBeInTheDocument()
  },
}

export const EmptyNote: Story = {
  args: {
    note: "",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByText("No note")).toBeInTheDocument()
  },
}
