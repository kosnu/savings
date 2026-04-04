import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { CategoryField } from "./CategoryField"

const meta = {
  title: "Features/PaymentDetails/CategoryField",
  component: CategoryField,
  args: {
    categoryName: "Food",
  },
} satisfies Meta<typeof CategoryField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByText("Category")).toBeInTheDocument()
    expect(canvas.getByText("Food")).toBeInTheDocument()
  },
}
