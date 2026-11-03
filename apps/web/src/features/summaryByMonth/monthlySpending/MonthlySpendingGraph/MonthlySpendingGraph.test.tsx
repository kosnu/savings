import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vite-plus/test"

import { render, screen, within } from "../../../../test/test-utils"
import * as stories from "./MonthlySpendingGraph.stories"

const { Default, OverBudget, ZeroBudget, NoBudget, UnsetBudget, Empty, PastMonth, FutureMonth } =
  composeStories(stories)

describe("MonthlySpendingGraph", () => {
  test("実績・見込み・予算を線種と読める金額で区別する", () => {
    render(<Default />)
    const figure = screen.getByRole("figure", { name: "Spending through the month" })
    for (const [label, amount] of [
      ["Actual spending", "¥5,000"],
      ["Month-end estimate", "¥10,000"],
      ["Monthly budget", "¥15,000"],
    ]) {
      expect(within(figure).getByText(label)).toBeInTheDocument()
      const caption = figure.querySelector("figcaption")
      if (!caption) throw new Error("凡例がありません")
      expect(within(caption).getByText(amount)).toBeInTheDocument()
    }
    expect(screen.getByText("Within budget · ¥5,000 remaining")).toBeInTheDocument()
    expect(screen.getByText(/average daily spending through today/)).toBeInTheDocument()
  })

  test.each([
    { Story: OverBudget, difference: "Over budget · ¥2,000" },
    { Story: ZeroBudget, difference: "Over budget · ¥10,000" },
  ])("予算超過を示し、予算0円も未設定と区別する", ({ Story, difference }) => {
    render(<Story />)
    expect(screen.getByText(difference)).toBeInTheDocument()
    expect(screen.queryByText("Not set")).not.toBeInTheDocument()
  })

  test.each([
    { Story: NoBudget, label: "No budget" },
    { Story: UnsetBudget, label: "Not set" },
  ])("$label は0円の予算や比較結果を作らない", ({ Story, label }) => {
    render(<Story />)
    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.queryByText(/Within budget|Over budget/)).not.toBeInTheDocument()
  })

  test("支払い0件の実績と見込みは0円として表示する", () => {
    render(<Empty />)
    expect(screen.getByText("Within budget · ¥15,000 remaining")).toBeInTheDocument()
    expect(screen.getAllByText("¥0")).toHaveLength(3)
  })

  test("過去月に見込みを作らず、実績と予算を比較する", () => {
    render(<PastMonth />)
    expect(screen.queryByText("Month-end estimate")).not.toBeInTheDocument()
    expect(screen.getByText("Within budget · ¥10,000 remaining")).toBeInTheDocument()
  })

  test("未来月は登録済みの支払いと明示し、見込みや実績と呼ばない", () => {
    render(<FutureMonth />)
    expect(screen.getByText("Recorded payments")).toBeInTheDocument()
    expect(screen.queryByText("Actual spending")).not.toBeInTheDocument()
    expect(screen.queryByText("Month-end estimate")).not.toBeInTheDocument()
    expect(screen.queryByText(/Within budget|Over budget/)).not.toBeInTheDocument()
  })
})
