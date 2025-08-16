import type { Meta, StoryObj } from "@storybook/react"
import { BaseField, type BaseFieldProps } from "./BaseField"

const meta: Meta<BaseFieldProps> = {
  title: "Common/Inputs/BaseField",
  component: BaseField,
  args: {
    label: "Label",
    children: <input type="text" placeholder="Input here" />,
  },
}

export default meta

type Story = StoryObj<BaseFieldProps>

export const Default: Story = {}

export const Required: Story = {
  args: {
    required: true,
  },
}

export const WithError: Story = {
  args: {
    error: true,
    message: "Error occurred",
  },
}
