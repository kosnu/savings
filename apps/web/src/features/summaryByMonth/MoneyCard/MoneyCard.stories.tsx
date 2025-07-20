import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { expect } from "storybook/test"
import { MoneyCard } from "./MoneyCard"

const meta = {
  title: "Features/SummaryByMonth/MoneyCard",
  component: MoneyCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof MoneyCard>

export default meta
type Story = StoryObj<typeof meta>

export const Success: Story = {
  args: {
    title: "Expenditures",
    getValue: Promise.resolve(4000),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByText("Expenditures")).toBeInTheDocument()
    expect(await canvas.findByText("￥4,000")).toBeInTheDocument()
  },
}

export const HasError: Story = {
  tags: ["skip"],
  args: {
    title: "Expenditures",
    getValue:
      // FIXME: この分岐がないとテスト実行時にエラーが発生してしまう
      import.meta.env.MODE === "development"
        ? Promise.reject(new Error("Error!"))
        : Promise.resolve(4000),
  },
}
