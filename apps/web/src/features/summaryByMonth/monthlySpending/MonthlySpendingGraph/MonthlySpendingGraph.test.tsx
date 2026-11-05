import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vite-plus/test"

import { i18next } from "../../../../i18n"
import { render, screen, within } from "../../../../test/test-utils"
import * as stories from "./MonthlySpendingGraph.stories"

const {
  Default,
  OverBudget,
  ZeroBudget,
  NoBudget,
  UnsetBudget,
  Empty,
  PastMonth,
  FutureMonth,
  NoHistory,
} = composeStories(stories)

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
    expect(screen.queryByText(/spending patterns from recorded months/)).not.toBeInTheDocument()
    expect(figure).not.toHaveAttribute("aria-describedby")
  })

  test.each([
    { Story: OverBudget, difference: "Forecast over budget · ¥2,000" },
    { Story: ZeroBudget, difference: "Forecast over budget · ¥10,000" },
  ])("当月の超過は見込みと明示し、予算0円も未設定と区別する", ({ Story, difference }) => {
    render(<Story />)
    expect(screen.getByText(difference)).toBeInTheDocument()
    expect(screen.queryByText("Not set")).not.toBeInTheDocument()
  })

  test("日本語でも実績が予算内のときに月末の超過見込みと短く表示する", async () => {
    await i18next.changeLanguage("ja")
    try {
      render(
        <OverBudget
          history={[{ month: "2025-05", payments: [{ date: "2025-05-20", amount: 68000 }] }]}
        />,
      )
      expect(screen.getByText("超過見込み · ¥65,000")).toBeInTheDocument()
      expect(screen.queryByText("予算超過・¥65,000")).not.toBeInTheDocument()
      expect(screen.queryByText(/直近3完了月の履歴がある月の日別平均/)).not.toBeInTheDocument()
    } finally {
      await i18next.changeLanguage("en")
    }
  })

  test("過去月の実際の超過には見込みラベルを付けない", () => {
    render(
      <OverBudget
        today={new Date(2025, 6, 1)}
        payments={[{ date: "2025-06-02", amount: 10000 }]}
      />,
    )
    expect(screen.getByText("Over budget · ¥2,000")).toBeInTheDocument()
    expect(screen.queryByText(/Forecast over budget/)).not.toBeInTheDocument()
  })

  test.each([
    { Story: NoBudget, label: "No budget" },
    { Story: UnsetBudget, label: "Not set" },
  ])("$label は0円の予算や比較結果を作らない", ({ Story, label }) => {
    render(<Story />)
    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.queryByText(/Within budget|Over budget/i)).not.toBeInTheDocument()
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
    expect(screen.queryByText(/Within budget|Over budget/i)).not.toBeInTheDocument()
  })
  test("履歴がないときは0円の見込みや予算比較を作らない", () => {
    render(<NoHistory />)
    expect(
      screen.getByText(
        "No estimate: there are no payment records in the previous three completed months.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText("Month-end estimate")).not.toBeInTheDocument()
    expect(screen.queryByText(/Within budget|Over budget/i)).not.toBeInTheDocument()
  })
})
