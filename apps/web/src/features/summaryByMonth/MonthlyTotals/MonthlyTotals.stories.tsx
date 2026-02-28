import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { MonthlyTotals } from "./MonthlyTotals"

const meta = {
  title: "Features/SummaryByMonth/MonthlyTotals",
  component: MonthlyTotals,
  tags: ["autodocs"],
  decorators: [createStoryRouter("/payments?year=2025&month=06")],
} satisfies Meta<typeof MonthlyTotals>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByText("Total spending")).toBeInTheDocument()
    expect(await canvas.findByText("￥10,000")).toBeInTheDocument()
  },
}
