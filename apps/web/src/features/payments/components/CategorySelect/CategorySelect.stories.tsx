import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { categories } from "../../../../test/data/categories"
import {
  CategoryOption,
  CategorySelect,
  ErrorCategoryOption,
  LoadingCategoryOption,
} from "./CategorySelect"

const meta = {
  title: "Features/Payments/Components/CategorySelect",
  component: CategorySelect,
  subcomponents: { CategoryOption, NoneCategoryOption: ErrorCategoryOption, LoadingCategoryOption },
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  render: (args) => {
    const [value, setValue] = useState<string | undefined>(args.value)

    return (
      <CategorySelect {...args} value={value} onChange={setValue}>
        {args.children}
      </CategorySelect>
    )
  },
} satisfies Meta<typeof CategorySelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: categories.map((category) => (
      <CategoryOption key={category.id} category={category} />
    )),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole("combobox"))

    const body = within(canvasElement.ownerDocument.body)
    expect(await body.findByRole("option", { name: /food/i })).toBeInTheDocument()
  },
}

export const Filled: Story = {
  args: {
    children: categories.map((category) => (
      <CategoryOption key={category.id} category={category} />
    )),
    value: String(categories[1]?.id),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByRole("combobox")).toHaveTextContent(categories[1]?.name ?? "")
  },
}

export const AllowEmptyOption: Story = {
  args: {
    allowEmptyOption: true,
    children: categories.map((category) => (
      <CategoryOption key={category.id} category={category} />
    )),
    value: String(categories[0]?.id),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole("combobox"))

    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole("option", { name: /^none$/i }))

    await waitFor(() => {
      expect(canvas.getByRole("combobox")).toHaveTextContent("None")
    })
  },
}

export const Loading: Story = {
  args: {
    children: <LoadingCategoryOption />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole("combobox"))

    const body = within(canvasElement.ownerDocument.body)
    expect(await body.findByRole("option", { name: /loading/i })).toBeInTheDocument()
  },
}

export const ErrorState: Story = {
  args: {
    children: <ErrorCategoryOption />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole("combobox"))

    const body = within(canvasElement.ownerDocument.body)
    expect(await body.findByRole("option", { name: /error/i })).toBeInTheDocument()
  },
}
