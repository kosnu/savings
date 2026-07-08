import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { monthlyBudgets } from "../../../../test/data/monthlyBudgets"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../../test/msw/server"
import { act, render, screen, within } from "../../../../test/test-utils"
import { MonthlyBudgetList } from "./MonthlyBudgetList"

async function renderMonthlyBudgetList() {
  return await act(async () => {
    return render(<MonthlyBudgetList />)
  })
}

describe("MonthlyBudgetList", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("月予算の年月と金額を一覧表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: {
          response: [monthlyBudgets[3], monthlyBudgets[2]],
        },
      }),
    )

    await renderMonthlyBudgetList()

    const table = await screen.findByRole("table")
    expect(within(table).getByText("Month")).toBeInTheDocument()
    expect(within(table).getByText("Amount")).toBeInTheDocument()
    expect(await within(table).findByText("2025/07")).toBeInTheDocument()
    expect(await within(table).findByText("¥75,000")).toBeInTheDocument()
    expect(await within(table).findByText("2025/03")).toBeInTheDocument()
    expect(await within(table).findByText("¥62,000")).toBeInTheDocument()
  })

  test("月予算がない場合は空状態を表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [] },
      }),
    )

    await renderMonthlyBudgetList()

    expect(await screen.findByText("No monthly budgets yet.")).toBeInTheDocument()
  })

  test("取得中はスケルトン行を表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [], durationOrMode: "infinite" },
      }),
    )

    await renderMonthlyBudgetList()

    expect(screen.getAllByLabelText("loading monthly budget")).toHaveLength(3)
  })

  test("取得に失敗した場合はエラー状態を表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { error: true },
      }),
    )

    await renderMonthlyBudgetList()

    expect(await screen.findByText("Could not load monthly budgets.")).toBeInTheDocument()
  })
})
