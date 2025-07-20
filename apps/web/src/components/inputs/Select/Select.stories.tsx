import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"
import { categories } from "../../../test/data/categories"
import { Select, SelectItem } from "./Select"

const meta = {
  title: "Common/Inputs/Select",
  component: Select,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: "Category",
    name: "category",
    children: categories.map((category) => {
      return (
        <SelectItem
          key={category.id}
          value={category?.id ?? "unknown"}
          label={category.name}
        />
      )
    }),
  },
}

export const Filled: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const select = canvas.getByRole("combobox", { name: /category/i })
    await userEvent.click(select)

    const body = within(canvasElement.ownerDocument.body)
    const listbox = await body.findByRole("listbox")
    const option = await within(listbox).findByRole("option", {
      name: /food/i,
    })
    await userEvent.click(option)
  },
}
