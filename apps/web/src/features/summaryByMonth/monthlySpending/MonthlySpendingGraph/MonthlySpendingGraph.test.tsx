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
  test("当日までの累積実績と翌日からの見込みを日ごとの棒で表示する", () => {
    render(<Default />)

    const plot = screen.getByLabelText("Daily cumulative spending")
    const bars = Array.from(plot.querySelectorAll("rect"))
    expect(plot.querySelector("polyline")).not.toBeInTheDocument()
    expect(bars).toHaveLength(29)
    expect(Number(bars[0].getAttribute("height"))).toBeCloseTo(12)
    expect(Number(bars[13].getAttribute("x"))).toBeCloseTo(283.5)
    expect(Number(bars[13].getAttribute("height"))).toBeCloseTo(60)
    expect(Number(bars[14].getAttribute("x"))).toBeCloseTo(303.5)
    expect(Number(bars[14].getAttribute("height"))).toBeCloseTo(60)
    expect(Number(bars[28].getAttribute("height"))).toBeCloseTo(120)
  })

  test("実績と見込みの金額を示し、予算線の凡例では金額を繰り返さない", () => {
    render(<Default />)
    const figure = screen.getByRole("figure", { name: "Cumulative spending" })
    const caption = figure.querySelector("figcaption")
    if (!caption) throw new Error("凡例がありません")
    const legend = within(caption)
    for (const [label, amount] of [
      ["Actual", "¥5,000"],
      ["Month-end estimate", "¥10,000"],
    ]) {
      expect(legend.getByText(label)).toBeInTheDocument()
      expect(legend.getByText(amount)).toBeInTheDocument()
    }
    expect(legend.getByText("Budget")).toBeInTheDocument()
    expect(legend.queryByText("¥15,000")).not.toBeInTheDocument()
    expect(screen.getByText("Estimated ¥5,000 left")).toBeInTheDocument()
    expect(screen.queryByText(/spending patterns from recorded months/)).not.toBeInTheDocument()
    expect(figure).not.toHaveAttribute("aria-describedby")
  })

  test.each([
    { Story: OverBudget, difference: "Estimated ¥2,000 over budget" },
    { Story: ZeroBudget, difference: "Estimated ¥10,000 over budget" },
  ])("当月の超過は見込みと明示し、予算0円も未設定と区別する", ({ Story, difference }) => {
    render(<Story />)
    expect(screen.getByText(difference)).toBeInTheDocument()
    expect(screen.queryByText("Not set")).not.toBeInTheDocument()
  })

  test("日本語でも実績が予算内のときに超過見込みと短く表示する", async () => {
    await i18next.changeLanguage("ja")
    try {
      render(
        <OverBudget
          history={[{ month: "2025-05", payments: [{ date: "2025-05-20", amount: 68000 }] }]}
        />,
      )
      expect(screen.getByText("超過見込み ¥65,000")).toBeInTheDocument()
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
    expect(screen.queryByText(/Estimated ¥/)).not.toBeInTheDocument()
  })

  test.each([
    { Story: NoBudget, status: "予算なし" },
    { Story: UnsetBudget, status: "未設定" },
  ])("$status では予算線の凡例や比較結果を表示しない", ({ Story }) => {
    render(<Story />)
    expect(screen.queryByText("Budget")).not.toBeInTheDocument()
    expect(screen.queryByText(/Within budget|Over budget|Estimated ¥/i)).not.toBeInTheDocument()
  })

  test("支払い0件の実績と見込みは0円として表示する", () => {
    render(<Empty />)
    const plot = screen.getByLabelText("Daily cumulative spending")
    expect(plot.querySelector("rect")).not.toBeInTheDocument()
    expect(screen.getByText("Estimated ¥15,000 left")).toBeInTheDocument()
    expect(screen.getAllByText("¥0")).toHaveLength(3)
  })

  test("過去月に見込みを作らず、実績と予算を比較する", () => {
    render(<PastMonth />)
    const plot = screen.getByLabelText("Daily cumulative spending")
    expect(plot.querySelectorAll("rect")).toHaveLength(29)
    expect(screen.queryByText("Month-end estimate")).not.toBeInTheDocument()
    expect(screen.getByText("Within budget · ¥10,000 remaining")).toBeInTheDocument()
  })

  test("未来月は登録済みの支払いと明示し、見込みや実績と呼ばない", () => {
    render(<FutureMonth />)
    expect(screen.getByText("Recorded")).toBeInTheDocument()
    expect(screen.queryByText("Actual")).not.toBeInTheDocument()
    expect(screen.queryByText("Month-end estimate")).not.toBeInTheDocument()
    expect(screen.queryByText(/Within budget|Over budget|Estimated ¥/i)).not.toBeInTheDocument()
  })
  test("履歴がないときは0円の見込みや予算比較を作らない", () => {
    render(<NoHistory />)
    expect(
      screen.getByText(
        "No estimate: there are no payment records in the previous three completed months.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText("Month-end estimate")).not.toBeInTheDocument()
    expect(screen.queryByText(/Within budget|Over budget|Estimated ¥/i)).not.toBeInTheDocument()
  })
})
