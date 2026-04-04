import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"

import { categories } from "../../../../test/data/categories"
import {
  CategoryOption,
  CategorySelect,
  ErrorCategoryOption,
  LoadingCategoryOption,
  NoneCategoryOption,
} from "./CategorySelect"

const categoryOptions = categories.map((category) => (
  <CategoryOption key={category.id} category={category} />
))

const meta = {
  title: "Features/Payments/Components/CategorySelect",
  component: CategorySelect,
  subcomponents: { CategoryOption, NoneCategoryOption, LoadingCategoryOption },
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  render: (args) => {
    const [value, setValue] = useState<string | undefined>(args.value)
    const handleChange = (nextValue: string) => {
      setValue(nextValue)
      args.onChange?.(nextValue)
    }

    return (
      <CategorySelect {...args} value={value} onChange={handleChange}>
        {args.children}
      </CategorySelect>
    )
  },
} satisfies Meta<typeof CategorySelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: categoryOptions,
  },
}

export const Filled: Story = {
  args: {
    children: categoryOptions,
    value: String(categories[1]?.id),
  },
}

export const Empty: Story = {
  args: {
    children: categoryOptions,
    value: "",
  },
}

export const EmptyWithAllowEmptyOption: Story = {
  args: {
    allowEmptyOption: true,
    children: categoryOptions,
    value: "",
  },
}

export const AllowEmptyOption: Story = {
  args: {
    allowEmptyOption: true,
    children: categoryOptions,
    value: String(categories[0]?.id),
  },
}

export const Loading: Story = {
  args: {
    children: <LoadingCategoryOption />,
  },
}

export const ErrorState: Story = {
  args: {
    children: <ErrorCategoryOption />,
  },
}
