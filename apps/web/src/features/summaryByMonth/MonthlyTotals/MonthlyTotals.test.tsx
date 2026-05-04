import { composeStories } from "@storybook/react-vite"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { render, screen, waitFor } from "../../../test/test-utils"
import * as stories from "./MonthlyTotals.stories"

const { Default } = composeStories(stories)

function renderStory() {
  return render(<Default />)
}

describe("MonthlyTotals", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("月次合計を表示する", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        getMonthlyTotalAmount: { response: 10000 },
      }),
      ...createMonthlyBudgetHandlers({
        get: { response: { ...monthlyBudgets[2], amount: 30000 } },
      }),
    )
    renderStory()

    expect(await screen.findByText("Total spending")).toBeInTheDocument()
    expect(await screen.findByText("￥10,000")).toBeInTheDocument()
    expect(await screen.findByText("￥20,000 left")).toBeInTheDocument()
  })

  test("月次合計が月予算を超えたら超過額を表示する", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        getMonthlyTotalAmount: { response: 45000 },
      }),
      ...createMonthlyBudgetHandlers({
        get: { response: { ...monthlyBudgets[2], amount: 30000 } },
      }),
    )
    renderStory()

    expect(await screen.findByText("￥45,000")).toBeInTheDocument()
    expect(await screen.findByText("￥15,000 over")).toBeInTheDocument()
  })

  test("月予算がない場合は差額を表示しない", async () => {
    server.resetHandlers(
      ...createPaymentHandlers({
        getMonthlyTotalAmount: { response: 10000 },
      }),
      ...createMonthlyBudgetHandlers({
        get: { response: null },
      }),
    )
    renderStory()

    expect(await screen.findByText("￥10,000")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText(/left|over|Could not get the budget/)).not.toBeInTheDocument()
    })
  })

  test("月予算の取得に失敗した場合は支出合計を残してエラーを表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createPaymentHandlers({
        getMonthlyTotalAmount: { response: 10000 },
      }),
      ...createMonthlyBudgetHandlers({
        get: { error: true },
      }),
    )
    renderStory()

    expect(await screen.findByText("￥10,000")).toBeInTheDocument()
    expect(await screen.findByText("Could not get the budget")).toBeInTheDocument()
  })
})
