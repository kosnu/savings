import type { Meta, StoryObj } from "@storybook/react-vite"

import { NoteField } from "./NoteField"

const meta = {
  title: "Features/CreatePayment/NoteField",
  component: NoteField,
  args: {},
} satisfies Meta<typeof NoteField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const HasError: Story = {
  args: {
    error: true,
    messages: ["This field is required"],
  },
}
