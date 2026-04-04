import type { Meta, StoryObj } from "@storybook/react-vite"

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

export const Default: Story = {}

export const EmptyNote: Story = {
  args: {
    note: "",
  },
}
