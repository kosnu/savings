import { Flex, Text, TextField } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"

import { EditableField } from "./EditableField"

const meta = {
  title: "Features/PaymentDetails/EditableField",
  component: EditableField,
  args: {
    label: "Amount",
    editButtonLabel: "Edit amount",
    editing: false,
    view: (
      <Text size="4" style={{ flex: 1 }}>
        ￥1,000
      </Text>
    ),
    editor: (
      <Flex align="center" gap="2">
        <div style={{ flex: 1 }}>
          <TextField.Root autoFocus defaultValue="1000" />
        </div>
      </Flex>
    ),
  },
} satisfies Meta<typeof EditableField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Editing: Story = {
  args: {
    editing: true,
  },
}

export const WithMessages: Story = {
  render: function Render(args) {
    const [editing, setEditing] = useState(false)

    return (
      <EditableField
        {...args}
        editing={editing}
        error
        messages={["Failed to update amount."]}
        onEdit={() => setEditing(true)}
      />
    )
  },
}
