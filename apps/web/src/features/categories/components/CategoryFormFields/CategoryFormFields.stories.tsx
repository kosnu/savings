import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { fn } from "storybook/test"

import { CategoryFormFields } from "./CategoryFormFields"

const meta = {
  title: "Features/Categories/Components/CategoryFormFields",
  component: CategoryFormFields,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    name: "",
    nameErrors: [],
    budgetAmount: "",
    budgetErrors: [],
    pinned: false,
    disabled: false,
    onNameChange: fn(),
    onBudgetAmountChange: fn(),
    onPinnedChange: fn(),
  },
  render: (args) => {
    const [name, setName] = useState(args.name)
    const [budgetAmount, setBudgetAmount] = useState(args.budgetAmount)
    const [pinned, setPinned] = useState(args.pinned)

    return (
      <CategoryFormFields
        {...args}
        name={name}
        budgetAmount={budgetAmount}
        pinned={pinned}
        onNameChange={(nextName) => {
          setName(nextName)
          args.onNameChange(nextName)
        }}
        onBudgetAmountChange={(nextBudgetAmount) => {
          setBudgetAmount(nextBudgetAmount)
          args.onBudgetAmountChange(nextBudgetAmount)
        }}
        onPinnedChange={(nextPinned) => {
          setPinned(nextPinned)
          args.onPinnedChange(nextPinned)
        }}
      />
    )
  },
} satisfies Meta<typeof CategoryFormFields>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ValidationError: Story = {
  args: {
    nameErrors: [{ message: "Category name cannot be empty" }],
    budgetErrors: [{ message: "Amount must be a number" }],
  },
}

export const Disabled: Story = {
  args: {
    name: "Food",
    budgetAmount: "30000",
    pinned: true,
    disabled: true,
  },
}
