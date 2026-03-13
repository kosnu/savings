import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { createStoryRouter, paymentsRouteBuilder } from "../../../test/helpers/routerDecorator"
import { CategoryTotals } from "./CategoryTotals"

const meta = {
  title: "Features/SummaryByMonth/CategoryTotals",
  component: CategoryTotals,
  tags: ["autodocs"],
  decorators: [createStoryRouter("/payments?year=2025&month=06", paymentsRouteBuilder)],
} satisfies Meta<typeof CategoryTotals>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    chunkSize: 2,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // 指定したチャンク数分の DataList が表示されていること
    expect(await canvas.findByLabelText(/category totals chunk 0/i)).toBeInTheDocument()
    expect(await canvas.findByLabelText(/category totals chunk 1/i)).toBeInTheDocument()

    // カテゴリごとの合計金額が表示されていること
    expect(await canvas.findByText("Food")).toBeInTheDocument()
    expect(await canvas.findByText("Daily Necessities")).toBeInTheDocument()
    expect(await canvas.findByText("Entertainment")).toBeInTheDocument()
    expect(await canvas.findByText("￥1,000")).toBeInTheDocument()
    expect(await canvas.findByText("￥4,000")).toBeInTheDocument()
    expect(await canvas.findAllByText("￥0")).toHaveLength(2)
  },
}
