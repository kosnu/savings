import type { Meta, StoryObj } from "@storybook/react-vite"

import { BaseField, FieldLabel, FieldMessages, type BaseFieldProps } from "./BaseField"

const meta: Meta<BaseFieldProps> = {
  title: "Common/Inputs/BaseField",
  component: BaseField,
  args: {
    children: (
      <>
        <FieldLabel htmlFor="base-field">Label</FieldLabel>
        <input id="base-field" type="text" placeholder="Input here" />
      </>
    ),
  },
}

export default meta

type Story = StoryObj<BaseFieldProps>

export const Default: Story = {}

export const Required: Story = {
  args: {
    children: (
      <>
        <FieldLabel htmlFor="base-field-required" required>
          Label
        </FieldLabel>
        <input id="base-field-required" type="text" placeholder="Input here" />
      </>
    ),
  },
}

export const WithError: Story = {
  args: {
    children: (
      <>
        <FieldLabel htmlFor="base-field-error">Label</FieldLabel>
        <input id="base-field-error" type="text" placeholder="Input here" />
        <FieldMessages error messages={["Error occurred"]} />
      </>
    ),
  },
}
