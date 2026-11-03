import { composeStories } from "@storybook/react-vite"
import { delay, HttpResponse, http } from "msw"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { monthlyBudgets } from "../../../../test/data/monthlyBudgets"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor } from "../../../../test/test-utils"
import * as stories from "./MonthlySpendingChart.stories"

const { Default, Loading } = composeStories(stories)

function resetHandlers() {
  server.resetHandlers(
    ...createPaymentHandlers(),
    ...createMonthlyBudgetHandlers({ get: { response: { ...monthlyBudgets[2], amount: 15000 } } }),
  )
}

describe("MonthlySpendingChart", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2025, 5, 15))
    resetHandlers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test("指定月の支払いと予算を取得してグラフに表示する", async () => {
    render(<Default />)
    expect(await screen.findByText("Within budget · ¥5,000 remaining")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: "Spending through the month" }),
    ).toBeInTheDocument()
  })

  test("前提データの読み込み中はグラフを取得しない", async () => {
    let requests = 0
    server.use(
      http.get("*/rest/v1/payments", () => {
        requests += 1
        return HttpResponse.json([])
      }),
    )
    render(<Loading />)
    expect(await screen.findByLabelText("Loading spending chart")).toBeInTheDocument()
    expect(requests).toBe(0)
  })

  test("独立した支払いと予算の取得を並行して開始する", async () => {
    let spendingStarted = false
    let budgetStarted = false
    server.use(
      http.get("*/rest/v1/payments", async () => {
        spendingStarted = true
        await delay("infinite")
      }),
      http.post("*/rest/v1/rpc/get_effective_monthly_budget", async () => {
        budgetStarted = true
        await delay("infinite")
      }),
    )
    render(<Default />)
    await waitFor(() => {
      expect(spendingStarted).toBe(true)
      expect(budgetStarted).toBe(true)
    })
    expect(screen.getByLabelText("Loading spending chart")).toBeInTheDocument()
  })

  test.each(["spending", "budget"])("%s 取得失敗から同じ月で再試行して復帰する", async (target) => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.use(
      ...(target === "spending"
        ? createPaymentHandlers({ get: { error: true } })
        : createMonthlyBudgetHandlers({ get: { error: true } })),
    )
    const { user } = render(<Default />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the spending chart")
    expect(screen.queryByRole("figure")).not.toBeInTheDocument()
    resetHandlers()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Within budget · ¥5,000 remaining")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Spending through the month" })).toHaveFocus()
  })

  test("取得失敗後に月を変更すると、新しい対象月の取得で復帰する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.use(...createPaymentHandlers({ get: { error: true } }))
    const { user } = render(<Default />)
    await screen.findByRole("alert")
    resetHandlers()
    await user.click(screen.getByRole("button", { name: "Previous month" }))
    expect(await screen.findByText("Completed month: actual spending only.")).toBeInTheDocument()
    expect(screen.getByText("Within budget · ¥15,000 remaining")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
